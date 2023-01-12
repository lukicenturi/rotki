import { type Blockchain } from '@rotki/common/lib/blockchain';
import { type MaybeRef } from '@vueuse/core';
import { type ComputedRef, type Ref } from 'vue';
import {
  type ChainInfo,
  type EvmChainInfo,
  type SupportedChains
} from '@/types/api/chains';

const isEvmChain = (info: ChainInfo): info is EvmChainInfo => {
  return info.type === 'evm';
};

export const useSupportedChains = createSharedComposable(() => {
  const { fetchSupportedChains } = useSupportedChainsApi();

  const supportedChains: Ref<SupportedChains> = asyncComputed<SupportedChains>(
    () => fetchSupportedChains(),
    [],
    {
      lazy: true
    }
  );

  const evmChainsData: ComputedRef<EvmChainInfo[]> = computed(() => {
    // isEvmChain guard does not work the same with useArrayFilter
    return get(supportedChains).filter(isEvmChain);
  });

  const txEvmChains: ComputedRef<EvmChainInfo[]> = useArrayFilter(
    evmChainsData,
    x => x.id !== 'AVAX'
  );

  const evmChains: ComputedRef<string[]> = useArrayMap(
    evmChainsData,
    x => x.id
  );

  const evmChainNames: ComputedRef<string[]> = useArrayMap(
    evmChainsData,
    x => x.evmChainName
  );

  const isEvm = (chain: MaybeRef<Blockchain>) =>
    computed(() => {
      return get(evmChains).includes(get(chain));
    });

  const supportsTransactions = (chain: MaybeRef<Blockchain>): boolean => {
    const chains = get(txEvmChains);
    const selectedChain = get(chain);
    return chains.some(x => x.id === selectedChain);
  };

  const getEvmChainName = (chain: Blockchain): string | null =>
    get(evmChainsData).find(x => x.id === chain)?.evmChainName || null;

  const getChainInfoById = (
    chain: MaybeRef<Blockchain>
  ): ComputedRef<ChainInfo | null> =>
    computed(() => {
      return get(supportedChains).find(x => x.id === get(chain)) || null;
    });

  const getNativeAsset = (chain: MaybeRef<Blockchain>) => {
    const blockchain = get(chain);
    return (
      get(evmChainsData).find(({ id }) => id === blockchain)?.nativeAsset ||
      blockchain
    );
  };

  return {
    supportedChains,
    evmChains,
    evmChainNames,
    txEvmChains,
    getNativeAsset,
    getEvmChainName,
    getChainInfoById,
    isEvm,
    supportsTransactions
  };
});
