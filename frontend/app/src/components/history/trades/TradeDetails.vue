<script setup lang="ts">
import { type TradeEntry } from '@/types/history/trade';

const props = withDefaults(
  defineProps<{
    span?: number;
    item: TradeEntry;
  }>(),
  {
    span: 1
  }
);

const { item } = toRefs(props);
const { t } = useI18n();
</script>

<template>
  <TableExpandContainer visible :colspan="span">
    <template #title>
      {{ t('closed_trades.details.title') }}
    </template>
    <div class="grid grid-cols-[auto_1fr] gap-4">
      <span class="font-medium">
        {{ t('closed_trades.details.fee') }}
      </span>

      <template v-if="!!item.fee">
        <AmountDisplay
          class="closed-trades__trade__fee"
          :asset="item.feeCurrency"
          :value="item.fee"
        />
      </template>
      <template v-else> - </template>

      <span class="font-medium">
        {{ t('closed_trades.details.link') }}
      </span>

      <template v-if="!item.link">
        {{ t('closed_trades.details.link_data') }}
      </template>

      <HashLink v-else :text="item.link" />

      <template v-if="item.notes">
        <span class="font-medium">
          {{ t('notes_display.notes') }}
        </span>
        <div class="break-words">
          {{ item.notes }}
        </div>
      </template>
    </div>
  </TableExpandContainer>
</template>
