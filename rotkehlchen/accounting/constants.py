from rotkehlchen.accounting.mixins.event import AccountingEventType
from rotkehlchen.accounting.structures.types import (
    EventCategory,
    EventCategoryDetails,
    HistoryEventSubType,
    HistoryEventType,
)
from rotkehlchen.chain.evm.decoding.constants import CPT_GAS

FREE_PNL_EVENTS_LIMIT = 1000
FREE_REPORTS_LOOKUP_LIMIT = 20

EVENT_CATEGORY_MAPPINGS = {  # possible combinations of types and subtypes mapped to their event category  # noqa: E501
    HistoryEventType.INFORMATIONAL: {
        HistoryEventSubType.NONE: EventCategory.INFORMATIONAL,
        HistoryEventSubType.GOVERNANCE: EventCategory.GOVERNANCE,
        HistoryEventSubType.REMOVE_ASSET: EventCategory.INFORMATIONAL,
        HistoryEventSubType.PLACE_ORDER: EventCategory.PLACE_ORDER,
        HistoryEventSubType.CREATE: EventCategory.CREATE_PROJECT,
        HistoryEventSubType.UPDATE: EventCategory.UPDATE_PROJECT,
        HistoryEventSubType.APPLY: EventCategory.APPLY,
        HistoryEventSubType.APPROVE: EventCategory.APPROVAL,
    }, HistoryEventType.RECEIVE: {
        HistoryEventSubType.REWARD: EventCategory.CLAIM_REWARD,
        HistoryEventSubType.RECEIVE_WRAPPED: EventCategory.RECEIVE,
        HistoryEventSubType.GENERATE_DEBT: EventCategory.BORROW,
        HistoryEventSubType.RETURN_WRAPPED: EventCategory.RECEIVE,
        HistoryEventSubType.AIRDROP: EventCategory.AIRDROP,
        HistoryEventSubType.DONATE: EventCategory.RECEIVE_DONATION,
        HistoryEventSubType.NONE: EventCategory.RECEIVE,
        HistoryEventSubType.LIQUIDATE: EventCategory.LIQUIDATION_REWARD,
    }, HistoryEventType.DEPOSIT: {
        HistoryEventSubType.DEPOSIT_ASSET: EventCategory.DEPOSIT,
        HistoryEventSubType.BRIDGE: EventCategory.BRIDGE_DEPOSIT,
        HistoryEventSubType.PLACE_ORDER: EventCategory.DEPOSIT,
        HistoryEventSubType.FEE: EventCategory.FEE,
    }, HistoryEventType.SPEND: {
        HistoryEventSubType.RETURN_WRAPPED: EventCategory.SEND,
        HistoryEventSubType.LIQUIDATE: EventCategory.LIQUIDATION_LOSS,
        HistoryEventSubType.PAYBACK_DEBT: EventCategory.REPAY,
        HistoryEventSubType.FEE: EventCategory.FEE,
        HistoryEventSubType.DONATE: EventCategory.DONATE,
        HistoryEventSubType.NONE: EventCategory.SEND,
    }, HistoryEventType.WITHDRAWAL: {
        HistoryEventSubType.REMOVE_ASSET: EventCategory.WITHDRAW,
        HistoryEventSubType.BRIDGE: EventCategory.BRIDGE_WITHDRAWAL,
        HistoryEventSubType.CANCEL_ORDER: EventCategory.CANCEL_ORDER,
        HistoryEventSubType.REFUND: EventCategory.REFUND,
        HistoryEventSubType.GENERATE_DEBT: EventCategory.BORROW,
        HistoryEventSubType.FEE: EventCategory.FEE,
    }, HistoryEventType.TRADE: {
        HistoryEventSubType.SPEND: EventCategory.SWAP_OUT,
        HistoryEventSubType.RECEIVE: EventCategory.SWAP_IN,
        HistoryEventSubType.NONE: EventCategory.INFORMATIONAL,  # verify
        HistoryEventSubType.FEE: EventCategory.FEE,
    }, HistoryEventType.RENEW: {
        HistoryEventSubType.NFT: EventCategory.RENEW,
    }, HistoryEventType.STAKING: {
        HistoryEventSubType.DEPOSIT_ASSET: EventCategory.DEPOSIT,
        HistoryEventSubType.REWARD: EventCategory.STAKING_REWARD,
        HistoryEventSubType.REMOVE_ASSET: EventCategory.WITHDRAW,
        HistoryEventSubType.BLOCK_PRODUCTION: EventCategory.CREATE_BLOCK,
        HistoryEventSubType.MEV_REWARD: EventCategory.MEV_REWARD,
        HistoryEventSubType.RECEIVE_WRAPPED: EventCategory.RECEIVE,
        HistoryEventSubType.FEE: EventCategory.FEE,
    }, HistoryEventType.TRANSFER: {
        HistoryEventSubType.DONATE: EventCategory.DONATE,
        HistoryEventSubType.NONE: EventCategory.TRANSFER,
    }, HistoryEventType.ADJUSTMENT: {
        HistoryEventSubType.SPEND: EventCategory.SEND,
        HistoryEventSubType.RECEIVE: EventCategory.RECEIVE,
    }, HistoryEventType.DEPLOY: {
        HistoryEventSubType.NONE: EventCategory.DEPLOY,
        HistoryEventSubType.SPEND: EventCategory.DEPLOY_WITH_SPEND,
        HistoryEventSubType.NFT: EventCategory.DEPLOY,
    }, HistoryEventType.MIGRATE: {
        HistoryEventSubType.SPEND: EventCategory.MIGRATE_OUT,
        HistoryEventSubType.RECEIVE: EventCategory.MIGRATE_IN,
    },
}

EVENT_CATEGORY_DETAILS = {
    EventCategory.SEND: {None: EventCategoryDetails(
        label='send',
        icon='arrow-up-line',
    )}, EventCategory.RECEIVE: {None: EventCategoryDetails(
        label='receive',
        icon='arrow-down-line',
        color='success',
    )}, EventCategory.SWAP_OUT: {None: EventCategoryDetails(
        label='swap',
        icon='arrow-go-forward-line',
    )}, EventCategory.SWAP_IN: {None: EventCategoryDetails(
        label='swap',
        icon='arrow-go-back-line',
        color='success',
    )}, EventCategory.MIGRATE_OUT: {None: EventCategoryDetails(
        label='migrate',
        icon='arrow-right-circle-line',
    )}, EventCategory.MIGRATE_IN: {None: EventCategoryDetails(
        label='migrate',
        icon='arrow-left-circle-line',
        color='success',
    )}, EventCategory.APPROVAL: {None: EventCategoryDetails(
        label='approval',
        icon='lock-unlock-line',
    )}, EventCategory.DEPOSIT: {None: EventCategoryDetails(
        label='deposit',
        icon='skip-up-line',
        color='success',
    )}, EventCategory.WITHDRAW: {None: EventCategoryDetails(
        label='withdraw',
        icon='skip-down-line',
    )}, EventCategory.AIRDROP: {None: EventCategoryDetails(
        label='airdrop',
        icon='gift-line',
    )}, EventCategory.BORROW: {None: EventCategoryDetails(
        label='borrow',
        icon='hand-coin-line',
    )}, EventCategory.REPAY: {None: EventCategoryDetails(
        label='repay',
        icon='history-line',
    )}, EventCategory.DEPLOY: {None: EventCategoryDetails(
        label='deploy',
        icon='rocket-line',
    )}, EventCategory.DEPLOY_WITH_SPEND: {None: EventCategoryDetails(
        label='deploy with spend',
        icon='rocket-2-line',
    )}, EventCategory.BRIDGE_DEPOSIT: {None: EventCategoryDetails(
        label='bridge',
        icon='skip-up-line',
        color='error',
    )}, EventCategory.BRIDGE_WITHDRAWAL: {None: EventCategoryDetails(
        label='bridge',
        icon='skip-down-line',
        color='success',
    )}, EventCategory.GOVERNANCE: {None: EventCategoryDetails(
        label='governance',
        icon='government-line',
    )}, EventCategory.DONATE: {None: EventCategoryDetails(
        label='donate',
        icon='hand-heart-line',
    )}, EventCategory.RECEIVE_DONATION: {None: EventCategoryDetails(
        label='receive donation',
        icon='heart-2-line',
    )}, EventCategory.RENEW: {None: EventCategoryDetails(
        label='renew',
        icon='loop-right-line',
    )}, EventCategory.PLACE_ORDER: {None: EventCategoryDetails(
        label='place order',
        icon='auction-line',
    )}, EventCategory.TRANSFER: {None: EventCategoryDetails(
        label='transfer',
        icon='swap-box-line',
    )}, EventCategory.STAKING_REWARD: {None: EventCategoryDetails(
        label='staking reward',
        icon='inbox-archive-line',
    )}, EventCategory.CLAIM_REWARD: {None: EventCategoryDetails(
        label='claim reward',
        icon='gift-2-line',
    )}, EventCategory.LIQUIDATION_REWARD: {None: EventCategoryDetails(
        label='liquidation reward',
        icon='drop-fill',
    )}, EventCategory.LIQUIDATION_LOSS: {None: EventCategoryDetails(
        label='liquidation loss',
        icon='contrast-drop-fill',
    )}, EventCategory.INFORMATIONAL: {None: EventCategoryDetails(
        label='informational',
        icon='information-line',
    )}, EventCategory.CANCEL_ORDER: {None: EventCategoryDetails(
        label='cancel order',
        icon='file-close-line',
        color='error',
    )}, EventCategory.REFUND: {None: EventCategoryDetails(
        label='refund',
        icon='refund-2-line',
    )}, EventCategory.FEE: {
        None: EventCategoryDetails(label='fee', icon='price-tag-line'),
        CPT_GAS: EventCategoryDetails(label='gas fee', icon='fire-line'),
    }, EventCategory.MEV_REWARD: {None: EventCategoryDetails(
        label='mev',
        icon='medal-line',
    )}, EventCategory.CREATE_BLOCK: {None: EventCategoryDetails(
        label='new block',
        icon='box-3-line',
    )}, EventCategory.CREATE_PROJECT: {None: EventCategoryDetails(
        label='new project',
        icon='file-add-line',
    )}, EventCategory.UPDATE_PROJECT: {None: EventCategoryDetails(
        label='update project',
        icon='file-edit-line',
    )}, EventCategory.APPLY: {None: EventCategoryDetails(
        label='apply',
        icon='save-line',
    )},
}

ACCOUNTING_EVENTS_ICONS = {
    AccountingEventType.TRADE: 'swap-box-line',
    AccountingEventType.FEE: 'price-tag-line',
    AccountingEventType.ASSET_MOVEMENT: 'token-swap-line',
    AccountingEventType.MARGIN_POSITION: 'percent-line',
    AccountingEventType.LOAN: 'shake-hands-line',
    AccountingEventType.PREFORK_ACQUISITION: 'git-branch-line',
    AccountingEventType.STAKING: 'seedling-line',
    AccountingEventType.HISTORY_EVENT: 'exchange-box-line',
    AccountingEventType.TRANSACTION_EVENT: 'arrow-left-right-line',
}
