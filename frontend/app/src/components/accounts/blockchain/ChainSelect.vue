<script setup lang="ts">
import { Blockchain } from '@rotki/common/lib/blockchain';
import { type PropType } from 'vue';
import ChainDisplay from '@/components/accounts/blockchain/ChainDisplay.vue';
import { Module } from '@/types/modules';

interface SupportedChain {
  symbol: Blockchain;
  name: string;
  icon?: string;
}

const chains: SupportedChain[] = [
  {
    symbol: Blockchain.ETH,
    name: 'Ethereum'
  },
  {
    symbol: Blockchain.ETH2,
    name: 'Beacon chain validator'
  },
  {
    symbol: Blockchain.BTC,
    name: 'Bitcoin'
  },
  {
    symbol: Blockchain.BCH,
    name: 'Bitcoin Cash'
  },
  {
    symbol: Blockchain.OPTIMISM,
    name: 'Optimism',
    icon: './assets/images/chains/optimism.svg'
  },
  {
    symbol: Blockchain.KSM,
    name: 'Kusama'
  },
  {
    symbol: Blockchain.DOT,
    name: 'Polkadot'
  },
  {
    symbol: Blockchain.AVAX,
    name: 'Avalanche'
  }
];

defineProps({
  value: {
    required: false,
    type: String as PropType<Blockchain | null>,
    default: ''
  },
  disabled: {
    required: false,
    type: Boolean,
    default: false
  },
  dense: {
    required: false,
    type: Boolean,
    default: false
  }
});

const rootAttrs = useAttrs();

const emit = defineEmits(['input']);

const updateBlockchain = (blockchain: Blockchain) => {
  emit('input', blockchain);
};

const { isModuleEnabled } = useModules();

const items = computed(() => {
  const isEth2Enabled = get(isModuleEnabled(Module.ETH2));

  if (!isEth2Enabled) {
    return chains.filter(({ symbol }) => symbol !== Blockchain.ETH2);
  }
  return chains;
});

const { t } = useI18n();
</script>

<template>
  <v-select
    :value="value"
    data-cy="account-blockchain-field"
    outlined
    class="account-form__chain"
    :items="items"
    :label="t('account_form.labels.blockchain')"
    :disabled="disabled"
    item-value="symbol"
    :dense="dense"
    v-bind="rootAttrs"
    @change="updateBlockchain"
  >
    <template #selection="{ item }">
      <chain-display :item="item" :dense="dense" />
    </template>
    <template #item="{ item }">
      <chain-display :item="item" />
    </template>
  </v-select>
</template>
