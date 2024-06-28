import { camelCase } from 'lodash-es';
import { Module, SUPPORTED_MODULES, type SupportedModule } from '@/types/modules';
import type { MaybeRef } from '@vueuse/core';
import type { ProtocolMetadata } from '@/types/defi';

export const useDefiMetadata = createSharedComposable(() => {
  const { fetchDefiMetadata } = useDefiApi();

  const { connected } = toRefs(useMainStore());

  const loading = ref<boolean>(false);

  const metadata: Ref<ProtocolMetadata[]> = asyncComputed<
    ProtocolMetadata[]
  >(() => {
    if (get(connected))
      return fetchDefiMetadata();

    return [];
  }, [], { evaluating: loading });

  const getDefiData = (
    identifier: MaybeRef<string>,
  ): ComputedRef<ProtocolMetadata | undefined> =>
    useArrayFind(
      metadata,
      item => camelCase(item.identifier) === camelCase(get(identifier)),
    );

  const getDefiDataByName = (
    name: MaybeRef<string>,
  ): ComputedRef<ProtocolMetadata | undefined> =>
    useArrayFind<ProtocolMetadata>(
      metadata,
      item => item.name === decodeHtmlEntities(get(name)),
    );

  const getDefiName = (identifier: MaybeRef<string>): ComputedRef<string> =>
    useValueOrDefault(
      useRefMap(getDefiData(identifier), i => i?.name && decodeHtmlEntities(i?.name)),
      identifier,
    );

  const getDefiImage = (identifier: MaybeRef<string>): ComputedRef<string> => computed(() => {
    const imageName = get(getDefiData(identifier))?.icon || `${get(identifier)}.svg`;
    return `./assets/images/protocols/${imageName}`;
  });

  const getDefiIdentifierByName = (
    name: MaybeRef<string>,
  ): ComputedRef<string> =>
    useValueOrDefault(
      useRefMap(getDefiDataByName(name), i => i?.identifier),
      name,
    );

  const customSupportedModulesData = [
    {
      identifier: Module.NFTS,
      name: 'NFTs',
      icon: './assets/images/protocols/nfts.png',
    },
    {
      identifier: Module.ETH2,
      name: 'ETH Staking',
      icon: './assets/images/protocols/ethereum.svg',
    },
  ];

  const supportedModulesData: ComputedRef<SupportedModule[]> = computed(() => SUPPORTED_MODULES.map((identifier) => {
    const customData = customSupportedModulesData.find(item => item.identifier === identifier);
    return customData || {
      identifier,
      name: get(getDefiName(identifier)),
      icon: get(getDefiImage(identifier)),
    };
  }));

  return {
    metadata,
    getDefiData,
    getDefiName,
    getDefiImage,
    getDefiIdentifierByName,
    loading,
    supportedModulesData,
  };
});
