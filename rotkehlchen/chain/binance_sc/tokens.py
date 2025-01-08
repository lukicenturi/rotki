from rotkehlchen.chain.evm.tokens import EvmTokens
from rotkehlchen.types import ChecksumEvmAddress


class BinanceSCTokens(EvmTokens):

    # -- methods that need to be implemented per chain
    def _per_chain_token_exceptions(self) -> set[ChecksumEvmAddress]:
        return set()
