<script setup lang="ts">
import { type Blockchain } from '@rotki/common/lib/blockchain';
import { type PropType } from 'vue';
import ListItem from '@/components/helper/ListItem.vue';

defineProps({
  item: {
    required: true,
    type: Object as PropType<{ symbol: Blockchain; name: string }>
  },
  dense: {
    required: false,
    type: Boolean,
    default: false
  }
});
</script>
<template>
  <list-item :dense="dense" :title="item.symbol" :subtitle="dense ? '' : item.name">
    <template #icon>
      <asset-icon size="26px" :identifier="item.symbol" />
    </template>
  </list-item>
</template>
