import { ALL_CENTRALIZED_EXCHANGES } from '@/services/session/consts';
import { useAssetMovements } from '@/store/history/asset-movements';
import { useLedgerActions } from '@/store/history/ledger-actions';
import { useTrades } from '@/store/history/trades';
import { useTransactions } from '@/store/history/transactions';
import { type SupportedExchange } from '@/types/exchanges';
import { Section } from '@/types/status';

export const usePurgeStore = defineStore('history/purge', () => {
  const { fetchTrades } = useTrades();
  const { fetchAssetMovements } = useAssetMovements();
  const { fetchLedgerActions } = useLedgerActions();
  const { fetchTransactions } = useTransactions();

  const purgeHistoryLocation = async (
    exchange: SupportedExchange
  ): Promise<void> => {
    await Promise.allSettled([
      fetchTrades(true, exchange),
      fetchAssetMovements(true, exchange),
      fetchLedgerActions(true, exchange)
    ]);
  };

  const purgeExchange = async (
    exchange: SupportedExchange | typeof ALL_CENTRALIZED_EXCHANGES
  ): Promise<void> => {
    const { resetStatus } = useStatusUpdater(Section.TRADES);

    if (exchange === ALL_CENTRALIZED_EXCHANGES) {
      resetStatus();
      resetStatus(Section.ASSET_MOVEMENT);
      resetStatus(Section.LEDGER_ACTIONS);
    } else {
      await purgeHistoryLocation(exchange);
    }
  };

  const purgeTransactions = async (): Promise<void> => {
    const { resetStatus } = useStatusUpdater(Section.TX);
    resetStatus();
    await fetchTransactions();
  };

  return {
    purgeExchange,
    purgeHistoryLocation,
    purgeTransactions
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(usePurgeStore, import.meta.hot));
}
