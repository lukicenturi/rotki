import json
import logging
from dataclasses import asdict, dataclass
from json.decoder import JSONDecodeError
from typing import TYPE_CHECKING, Any, Final, Literal
from urllib.parse import urljoin

import requests
from oauthlib.oauth2 import WebApplicationClient

from rotkehlchen.chain.evm.decoding.monerium.constants import CPT_MONERIUM
from rotkehlchen.db.cache import DBCacheStatic
from rotkehlchen.db.filtering import EvmEventFilterQuery
from rotkehlchen.db.history_events import DBHistoryEvents
from rotkehlchen.db.settings import CachedSettings
from rotkehlchen.errors.api import AuthenticationError
from rotkehlchen.errors.misc import RemoteError
from rotkehlchen.errors.serialization import DeserializationError
from rotkehlchen.history.events.structures.types import HistoryEventSubType, HistoryEventType
from rotkehlchen.logging import RotkehlchenLogsAdapter
from rotkehlchen.types import EVMTxHash, Location, deserialize_evm_tx_hash
from rotkehlchen.utils.misc import set_user_agent, ts_now
from rotkehlchen.utils.network import create_session
from rotkehlchen.utils.serialization import jsonloads_list

if TYPE_CHECKING:
    from rotkehlchen.db.dbhandler import DBHandler
    from rotkehlchen.history.events.structures.evm_event import EvmEvent

logger = logging.getLogger(__name__)
log = RotkehlchenLogsAdapter(logger)

# Number of individual tx queries to allow before simply querying all with a single query and
# reprocessing any events that we already have.
MAX_INDIVIDUAL_TX_QUERIES: Final = 4

# TODO move this to env
MONERIUM_API_BASE_URL = 'https://api.monerium.dev/'
MONERIUM_ORDERS_ENDPOINT = 'orders'
MONERIUM_TOKEN_ENDPOINT = 'auth/token'
MONERIUM_CONTEXT_ENDPOINT = 'auth/context'
MONERIUM_ACCEPT_HEADER = 'application/vnd.monerium.api-v2+json'
MONERIUM_OAUTH_STORAGE_KEY = 'monerium_oauth_credentials'
TOKEN_REFRESH_MARGIN_SECONDS: Final = 60


class Monerium:
    """This is the monerium API interface

    https://monerium.dev/docs/
    https://monerium.dev/docs/getting-started/auth-flow
    """

    def __init__(self, database: 'DBHandler') -> None:
        self.database = database
        self.session = create_session()
        set_user_agent(self.session)
        self.oauth_client = MoneriumOAuthClient(database=self.database, session=self.session)

    def _query(
            self,
            endpoint: str,
            params: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Query a monerium API endpoint using OAuth authenticated requests."""
        if not self.oauth_client.is_authenticated():
            raise AuthenticationError('Monerium not authenticated')

        log.debug(f'Querying monerium API {endpoint}')
        timeout = CachedSettings().get_timeout_tuple()
        return self.oauth_client.get(endpoint, params, timeout)

    def is_authenticated(self) -> bool:
        return self.oauth_client.is_authenticated()

    def get_oauth_status(self) -> dict[str, Any]:
        return self.oauth_client.get_status()

    def complete_oauth(
            self,
            access_token: str,
            refresh_token: str,
            expires_in: int,
            client_id: str,
            token_type: str = 'Bearer',  # noqa: S107
    ) -> dict[str, Any]:
        return self.oauth_client.complete_oauth(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=expires_in,
            client_id=client_id,
            token_type=token_type,
        )

    def disconnect(self) -> dict[str, Any]:
        return self.oauth_client.disconnect()

    def get_and_process_orders(self, tx_hash: EVMTxHash | None = None) -> None:
        """Gets all monerium orders and processes them

        Find all on-chain transactions that match those orders and enrich them appropriately.
        If some of those transactions have not yet been pulled do nothing. Since this
        processing has no pagination and all orders will be pulled again next time this runs.

        This only runs for premium users. The check is on the caller which at
        the moment of writing is the periodic task manager.

        May raise:
        - RemoteError if there is trouble contacting the api

        The way this is currently called all exceptions would kill the task and write
        a stack trace in the logs.

        At the moment monerium has no fees, so this is not processing any fees.
        """
        with self.database.conn.write_ctx() as write_cursor:
            write_cursor.execute(  # remember last time task ran
                'INSERT OR REPLACE INTO key_value_cache (name, value) VALUES (?, ?)',
                (DBCacheStatic.LAST_MONERIUM_QUERY_TS.value, str(ts_now())),
            )

        orders = self._query(
            endpoint=MONERIUM_ORDERS_ENDPOINT,
            params={'txHash': tx_hash.hex()} if tx_hash is not None else None,
        )
        dbevents = DBHistoryEvents(self.database)
        for order in orders:  # orders are returned latest first
            log.debug(f'Processing monerium order {order}')
            if (kind := order['kind']) not in ('redeem', 'issue'):
                log.warning(f'Found order with unexpected {kind=}. Skipping.')
                continue

            try:  # avoid having multiple try/excepts blocks around the logic
                tx_hashes = order['txHashes']
                counterparty = order['counterpart']
                chain = order['chain']
                amount = order['amount']
                cpt_details = counterparty['details']
            except KeyError as e:
                log.error(f'monerium order response {order} has missing key {e}. Skipping')
                continue

            hashes_num = len(tx_hashes)

            new_type, new_subtype = None, None
            if hashes_num == 2:  # moving from one chain to another
                new_subtype = HistoryEventSubType.BRIDGE
                try:
                    if kind == 'redeem':
                        idx = 0
                        suffix = f'to {counterparty["identifier"]["chain"]}'
                        new_type = HistoryEventType.DEPOSIT
                    else:  # issue
                        idx = 1
                        suffix = f'from {counterparty["identifier"]["chain"]}'
                        new_type = HistoryEventType.WITHDRAWAL
                except KeyError as e:
                    log.error(f'Missing key {e} in monerium order response {order}. Skipping')
                    continue

                tx_hash_raw = tx_hashes[idx]
                new_notes = f'Bridge {amount} EURe {suffix}'
                if (memo := order.get('memo')):
                    new_notes += f' with memo "{memo}"'

            elif hashes_num == 1:
                tx_hash_raw = tx_hashes[0]
                if kind == 'redeem':
                    verb = 'Send'
                    preposition = 'to'
                else:  # issue
                    verb = 'Receive'
                    preposition = 'from'

                details = ''
                if cpt_details:
                    name = cpt_details.get('name', '')
                    iban = counterparty.get('identifier', {}).get('iban', '')
                    details = f'{name}'
                    if iban:
                        details += f' ({iban})'

                new_notes = f'{verb} {amount} EURe via bank transfer {preposition} {details}'
                if (memo := order.get('memo')):
                    new_notes += f' with memo "{memo}"'

            else:
                log.warning(f'Found order with unexpected {hashes_num=}. Skipping.')
                continue

            try:
                tx_hash = deserialize_evm_tx_hash(tx_hash_raw)
            except DeserializationError as e:
                log.error(f'Monerium API returned an invalid tx hash {tx_hash_raw}. Skipping entry {e}')  # noqa: E501
                continue

            match chain:
                case 'ethereum':
                    location = Location.ETHEREUM
                case 'gnosis':
                    location = Location.GNOSIS
                case 'polygon':
                    location = Location.POLYGON_POS
                case _:
                    log.warning(f'Found order with unexpected chain {order["chain"]}')
                    continue

            # now get the corresponding event
            with self.database.conn.read_ctx() as cursor:
                events = dbevents.get_history_events_internal(
                    cursor=cursor,
                    filter_query=EvmEventFilterQuery.make(
                        tx_hashes=[tx_hash],
                        counterparties=[CPT_MONERIUM],
                        location=location,
                    ),
                )

            if len(events) != 1:
                log.error(f'Could not find monerium event corresponding to {location!s} {tx_hash.hex()} in the DB. Skipping.')  # pylint: disable=no-member # noqa: E501
                continue

            if self.is_monerium_event_edited(event_notes=(event := events[0]).notes):
                continue  # skip if the event is already edited

            querystr = 'UPDATE history_events SET notes=? '
            bindings: list[Any] = [new_notes]
            if new_type:
                querystr = 'UPDATE history_events SET notes=?, type=?, subtype=? '
                bindings.extend([new_type.serialize(), new_subtype.serialize()])  # type: ignore  # both type/subtype are set
            querystr += 'WHERE identifier=?'
            bindings.append(event.identifier)
            with self.database.user_write() as write_cursor:
                write_cursor.execute(querystr, bindings)

    def update_events(self, events: list['EvmEvent']) -> None:
        """Query and update the event txs individually.
        Skips any events that have already been edited.
        Falls back to simply querying all orders if there are too many individual queries.

        May raise:
            - RemoteError if there is trouble contacting the api
        """
        tx_hashes = set()
        for event in events:
            if not self.is_monerium_event_edited(event_notes=event.notes):
                tx_hashes.add(event.tx_hash)

        if len(tx_hashes) <= MAX_INDIVIDUAL_TX_QUERIES:
            for tx_hash in tx_hashes:
                self.get_and_process_orders(tx_hash=tx_hash)
        else:  # query all instead if there are too many to query individually
            self.get_and_process_orders()

    @staticmethod
    def is_monerium_event_edited(event_notes: str | None) -> bool:
        """Check if an event has already been edited.
        Simply checks whether the notes have been edited to no longer start with Burn or Mint.
        While this is a bit hacky, it avoids needing to save any special state in the DB when
        editing these events.
        """
        return event_notes is not None and not event_notes.startswith(('Burn', 'Mint'))


def init_monerium(database: 'DBHandler') -> Monerium | None:
    """Create a monerium instance using the provided database"""
    monerium = Monerium(database=database)
    if not monerium.is_authenticated():
        return None
    return monerium


@dataclass
class MoneriumOAuthCredentials:
    access_token: str
    refresh_token: str
    expires_at: int
    client_id: str
    token_type: str = 'Bearer'
    user_email: str | None = None
    default_profile_id: str | None = None
    profiles: list[dict[str, Any]] | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> 'MoneriumOAuthCredentials':
        return cls(
            access_token=data['access_token'],
            refresh_token=data['refresh_token'],
            expires_at=int(data['expires_at']),
            client_id=data['client_id'],
            token_type=data.get('token_type', 'Bearer'),
            user_email=data.get('user_email'),
            default_profile_id=data.get('default_profile_id'),
            profiles=data.get('profiles'),
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def is_expiring(self) -> bool:
        return self.expires_at <= ts_now() + TOKEN_REFRESH_MARGIN_SECONDS


class MoneriumOAuthClient:
    """Handles Monerium OAuth token lifecycle and authenticated requests."""

    def __init__(self, database: 'DBHandler', session: requests.Session) -> None:
        self.database = database
        self.session = session
        self.session.headers.setdefault('Accept', MONERIUM_ACCEPT_HEADER)
        self._credentials: MoneriumOAuthCredentials | None = self._load_credentials()
        self._oauth_client: WebApplicationClient | None = None
        if self._credentials is not None:
            self._oauth_client = WebApplicationClient(self._credentials.client_id)

    def _load_credentials(self) -> MoneriumOAuthCredentials | None:
        with self.database.conn.read_ctx() as cursor:
            result = cursor.execute(
                'SELECT value FROM key_value_cache WHERE name=?',
                (MONERIUM_OAUTH_STORAGE_KEY,),
            ).fetchone()

        if result is None:
            return None

        try:
            raw_data = json.loads(result[0])
        except (TypeError, JSONDecodeError) as exc:
            log.error(f'Failed to parse stored Monerium OAuth credentials: {exc!s}')
            return None

        try:
            return MoneriumOAuthCredentials.from_dict(raw_data)
        except KeyError as exc:
            log.error(f'Missing key {exc!s} in stored Monerium OAuth credentials')
            return None

    def _store_credentials(self, credentials: MoneriumOAuthCredentials) -> None:
        with self.database.conn.write_ctx() as write_cursor:
            write_cursor.execute(
                'INSERT OR REPLACE INTO key_value_cache (name, value) VALUES (?, ?)',
                (MONERIUM_OAUTH_STORAGE_KEY, json.dumps(credentials.to_dict())),
            )

    def _clear_credentials(self) -> None:
        with self.database.conn.write_ctx() as write_cursor:
            write_cursor.execute(
                'DELETE FROM key_value_cache WHERE name=?',
                (MONERIUM_OAUTH_STORAGE_KEY,),
            )
        self._credentials = None
        self._oauth_client = None

    def is_authenticated(self) -> bool:
        return self._credentials is not None

    def get_status(self) -> dict[str, Any]:
        credentials = self._credentials
        if credentials is None:
            return {'authenticated': False}

        return {
            'authenticated': True,
            'user_email': credentials.user_email,
            'default_profile_id': credentials.default_profile_id,
            'profiles': credentials.profiles or [],
            'expires_at': credentials.expires_at,
            'token_type': credentials.token_type,
        }

    def complete_oauth(
            self,
            *,
            access_token: str,
            refresh_token: str,
            expires_in: int,
            client_id: str,
            token_type: str = 'Bearer',  # noqa: S107
    ) -> dict[str, Any]:
        expires_at = ts_now() + int(expires_in)
        credentials = MoneriumOAuthCredentials(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at,
            client_id=client_id,
            token_type=token_type or 'Bearer',
        )

        self._credentials = credentials
        self._oauth_client = WebApplicationClient(client_id)
        self._store_credentials(credentials)

        try:
            context = self._fetch_user_context()
        except RemoteError as exc:
            log.error(f'Failed to fetch Monerium context during OAuth completion: {exc!s}')
            self._clear_credentials()
            raise
        else:
            credentials.user_email = context.get('email')
            credentials.default_profile_id = context.get('defaultProfile')
            credentials.profiles = context.get('profiles')
            self._store_credentials(credentials)

        return {
            'success': True,
            'message': 'Successfully authenticated with Monerium',
            'user_email': credentials.user_email,
            'default_profile_id': credentials.default_profile_id,
            'profiles': credentials.profiles or [],
        }

    def disconnect(self) -> dict[str, Any]:
        self._clear_credentials()
        return {'success': True}

    def ensure_access_token(self) -> None:
        credentials = self._credentials
        if credentials is None:
            raise AuthenticationError('Monerium not authenticated')

        if not credentials.is_expiring():
            return

        self._refresh_access_token()

    def request(
            self,
            method: Literal['GET', 'POST'],
            endpoint: str,
            *,
            params: dict[str, Any] | None = None,
            data: Any | None = None,
            headers: dict[str, str] | None = None,
            timeout: tuple[float, float] | None = None,
    ) -> requests.Response:
        self.ensure_access_token()
        credentials = self._credentials
        assert credentials is not None  # for mypy

        auth_headers = {
            'Authorization': f'{credentials.token_type} {credentials.access_token}',
            'Accept': MONERIUM_ACCEPT_HEADER,
        }
        if headers:
            auth_headers.update(headers)

        url = urljoin(MONERIUM_API_BASE_URL, endpoint)
        try:
            response = self.session.request(
                method=method,
                url=url,
                params=params,
                data=data,
                headers=auth_headers,
                timeout=timeout,
            )
        except requests.exceptions.RequestException as exc:
            raise RemoteError(f'Querying {url} failed due to {exc!s}') from exc

        if response.status_code == 401:
            # Tokens are invalid, clear stored credentials so user can re-authenticate.
            self._clear_credentials()
            raise AuthenticationError('Monerium access token rejected. Please re-authorize.')

        return response

    def get(
            self, endpoint: str, params: dict[str, Any] | None, timeout: tuple[float, float],
    ) -> list[dict[str, Any]]:
        response = self.request('GET', endpoint, params=params, timeout=timeout)

        if response.status_code != 200:
            raise RemoteError(
                f'Monerium API request {response.url} failed with HTTP status code '
                f'{response.status_code} and text {response.text}',
            )

        try:
            return jsonloads_list(response.text)
        except JSONDecodeError as exc:
            raise RemoteError(
                f'Monerium API returned invalid JSON response: {response.text}',
            ) from exc

    def _fetch_user_context(self) -> dict[str, Any]:
        timeout = CachedSettings().get_timeout_tuple()
        response = self.request('GET', MONERIUM_CONTEXT_ENDPOINT, timeout=timeout)

        if response.status_code != 200:
            raise RemoteError(
                f'Failed to query Monerium auth context: {response.status_code} {response.text}',
            )

        try:
            return response.json()
        except ValueError as exc:
            raise RemoteError('Monerium auth context returned invalid JSON') from exc

    def _refresh_access_token(self) -> None:
        credentials = self._credentials
        if credentials is None:
            raise AuthenticationError('Monerium not authenticated')

        if self._oauth_client is None:
            self._oauth_client = WebApplicationClient(credentials.client_id)

        body = self._oauth_client.prepare_refresh_body(
            refresh_token=credentials.refresh_token,
            scope=None,
            body='',
            include_client_id=True,
        )
        headers = {'Content-Type': 'application/x-www-form-urlencoded'}
        timeout = CachedSettings().get_timeout_tuple()

        try:
            response = self.session.post(
                url=urljoin(MONERIUM_API_BASE_URL, MONERIUM_TOKEN_ENDPOINT),
                data=body,
                headers=headers,
                timeout=timeout,
            )
        except requests.exceptions.RequestException as exc:
            raise RemoteError(f'Failed to refresh Monerium access token: {exc!s}') from exc

        if response.status_code != 200:
            self._clear_credentials()
            raise AuthenticationError(
                f'Failed to refresh Monerium access token: {response.status_code} {response.text}',
            )

        token_response = self._oauth_client.parse_request_body_response(response.text)

        access_token = token_response.get('access_token')
        if not access_token:
            raise AuthenticationError('Monerium token refresh did not return an access token')

        refresh_token = token_response.get('refresh_token', credentials.refresh_token)
        expires_in_raw = token_response.get('expires_in', 3600)
        try:
            expires_in = int(expires_in_raw)
        except (TypeError, ValueError):
            expires_in = 3600

        credentials.access_token = access_token
        credentials.refresh_token = refresh_token
        credentials.expires_at = ts_now() + expires_in
        credentials.token_type = token_response.get(
            'token_type', credentials.token_type or 'Bearer',
        )

        self._store_credentials(credentials)
