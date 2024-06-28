<script setup lang="ts">
import type {
  Module,
  SupportedModule,
} from '@/types/modules';

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    value?: string;
    items?: Module[];
  }>(),
  {
    value: '',
    items: () => [],
  },
);

const emit = defineEmits<{
  (e: 'input', value: string): void;
}>();

const model = useSimpleVModel(props, emit);

const { supportedModulesData } = useDefiMetadata();

const modules = computed<SupportedModule[]>(() => {
  const items = props.items;

  return get(supportedModulesData).filter(({ identifier }) =>
    items && items.length > 0 ? items.includes(identifier) : true,
  );
});
</script>

<template>
  <RuiAutoComplete
    v-bind="$attrs"
    v-model="model"
    data-cy="defi-input"
    :options="modules"
    key-attr="identifier"
    text-attr="name"
    auto-select-first
    clearable
    variant="outlined"
    :item-height="52"
    v-on="
      // eslint-disable-next-line vue/no-deprecated-dollar-listeners-api
      $listeners
    "
  >
    <template #selection="{ item }">
      <DefiIcon :item="item" />
    </template>
    <template #item="{ item }">
      <DefiIcon :item="item" />
    </template>
  </RuiAutoComplete>
</template>
