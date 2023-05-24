<script setup lang="ts">
import { type CustomAsset } from '@/types/asset';
import CustomAssetForm from '@/components/asset-manager/CustomAssetForm.vue';

const props = withDefaults(
  defineProps<{
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
  (e: 'saved', assetId: string): void;
}>();

const { editableItem } = toRefs(props);
const { t } = useI18n();

const {
  valid,
  openDialog,
  submitting,
  closeDialog,
  trySubmit,
  setPostSubmitFunc
} = getInjectedForm<string>();

const postSubmit = (assetId: string) => {
  emit('saved', assetId);
};

setPostSubmitFunc(postSubmit);
</script>

<template>
  <big-dialog
    :display="openDialog"
    :title="title"
    :subtitle="subtitle"
    :action-disabled="submitting || !valid"
    :primary-action="t('common.actions.save')"
    :loading="submitting"
    @confirm="trySubmit()"
    @cancel="closeDialog()"
  >
    <custom-asset-form :types="types" :edit="editableItem" />
  </big-dialog>
</template>
