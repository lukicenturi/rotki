import type { BitcoinChainAddress, EvmChainAddress } from '@/types/history/events';
import { useSupportedChains } from '@/composables/info/chains';
import { useAccountAddresses } from '@/modules/balances/blockchain/use-account-addresses';
import { logger } from '@/utils/logging';

interface UseAccountChangeRefreshReturn {
  watchForNewAccounts: (
    onNewAccounts: (accounts: Array<EvmChainAddress | BitcoinChainAddress>) => Promise<void>
  ) => void;
}

export function useAccountChangeRefresh(): UseAccountChangeRefreshReturn {
  const { addresses } = useAccountAddresses();
  const { getEvmChainName, isBtcChains } = useSupportedChains();

  const watchForNewAccounts = (
    onNewAccounts: (accounts: Array<EvmChainAddress | BitcoinChainAddress>) => Promise<void>,
  ): void => {
    watch(addresses, async (newAddresses, oldAddresses) => {
      // Skip if this is the first load (oldAddresses is undefined)
      if (!oldAddresses || Object.keys(oldAddresses).length === 0) {
        return;
      }

      // Find newly added accounts
      const newAccounts: Array<EvmChainAddress | BitcoinChainAddress> = [];

      for (const [chain, chainAddresses] of Object.entries(newAddresses)) {
        const oldChainAddresses = oldAddresses[chain] || [];
        const addedAddresses = chainAddresses.filter(addr => !oldChainAddresses.includes(addr));

        if (addedAddresses.length > 0) {
          // Let refreshTransactions handle the account type separation
          // Just create the appropriate account structure based on chain type
          if (isBtcChains(chain)) {
            // Bitcoin account
            newAccounts.push(...addedAddresses.map(address => ({
              address,
              chain,
            })));
          }
          else {
            // EVM or EVM-like account
            const evmChain = getEvmChainName(chain) || chain;
            newAccounts.push(...addedAddresses.map(address => ({
              address,
              evmChain,
            })));
          }
        }
      }

      // Call the callback with new accounts if there are any
      if (newAccounts.length > 0) {
        logger.info(`Detected ${newAccounts.length} new accounts, triggering refresh`);
        await onNewAccounts(newAccounts);
      }
    }, { deep: true });
  };

  return {
    watchForNewAccounts,
  };
}
