<script setup lang="ts">
import { type Ref } from 'vue';
import { type CustomAsset } from '@/types/asset';
import CustomAssetForm from '@/components/asset-manager/CustomAssetForm.vue';
import { checkBeforeSubmission } from '@/utils/validation';

const props = withDefaults(
  defineProps<{
    value: boolean;
    title: string;
    subtitle?: string;
    types?: string[];
    editableItem?: CustomAsset | null;
  }>(),
  {
    subtitle: '',
    types: () => [],
    editableItem: null
  }
);

const emit = defineEmits<{
  (e: 'input', open: boolean): void;
  (e: 'saved', assetId: string): void;
}>();

const { value, editableItem } = toRefs(props);

const valid: Ref<boolean> = ref(true);
const saving: Ref<boolean> = ref(false);
const form: Ref<InstanceType<typeof CustomAssetForm> | null> = ref(null);

const clearDialog = () => {
  emit('input', false);
};

const confirmSave = () => {
  checkBeforeSubmission(save, get(form)?.v$, valid);
};

const save = async () => {
  if (!isDefined(form)) {
    return;
  }
  set(saving, true);
  const assetId = await get(form).save();
  if (assetId) {
    clearDialog();
    emit('saved', assetId);
  }
  set(saving, false);
};

const { tc } = useI18n();

watch(value, value => {
  if (value) {
    set(valid, true);
  }
});
</script>

<template>
  <big-dialog
    :display="value"
    :title="title"
    :subtitle="subtitle"
    :action-disabled="saving || !valid"
    :primary-action="tc('common.actions.save')"
    :loading="saving"
    @confirm="confirmSave()"
    @cancel="clearDialog()"
  >
    <custom-asset-form
      ref="form"
      :types="types"
      :edit="editableItem"
      @valid="valid = $event"
    />
  </big-dialog>
</template>
