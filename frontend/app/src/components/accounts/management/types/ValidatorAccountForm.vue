<script setup lang="ts">
import Eth2Input from '@/components/accounts/blockchain/Eth2Input.vue';
import type { StakingValidatorManage } from '@/composables/accounts/blockchain/use-account-manage';
import type { ValidationErrors } from '@/types/api/errors';

const props = defineProps<{
  modelValue: StakingValidatorManage;
  errorMessages: ValidationErrors;
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:model-value', value: StakingValidatorManage): void;
  (e: 'update:error-messages', value: ValidationErrors): void;
}>();

const input = ref<InstanceType<typeof Eth2Input>>();

const validator = useSimplePropVModel(props, 'data', emit);
const errors = useKebabVModel(props, 'errorMessages', emit);

function validate(): Promise<boolean> {
  assert(isDefined(input));
  return get(input).validate();
}

defineExpose({
  validate,
});
</script>

<template>
  <Eth2Input
    ref="input"
    v-model:validator="validator"
    v-model:error-messages="errors"
    :disabled="loading || modelValue.mode === 'edit'"
  />
</template>
