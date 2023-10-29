<script setup lang="ts">
const props = defineProps<{
  type: string;
}>();

const { getAccountingEventTypeData } = useHistoryEventMappings();

const { type } = toRefs(props);
const data = getAccountingEventTypeData(type);
const icon = useRefMap(data, ({ icon }) => icon);
const label = useRefMap(data, ({ label }) => label);
</script>

<template>
  <span class="flex items-center flex-column">
    <RuiIcon :name="icon" color="secondary" />
    <span class="mt-1 text-no-wrap">
      {{ label }}
    </span>
  </span>
</template>
