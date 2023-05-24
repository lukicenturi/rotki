<script lang="ts" setup>
import { type Trade } from '@/types/history/trade';

const props = withDefaults(
  defineProps<{
    editableItem?: Trade | null;
    loading?: boolean;
  }>(),
  {
    editableItem: null
  }
);

const { editableItem } = toRefs(props);

const emit = defineEmits<{
  (e: 'reset-edit'): void;
  (e: 'saved'): void;
}>();

const {
  valid,
  openDialog,
  submitting,
  closeDialog,
  trySubmit,
  setPostSubmitFunc
} = getInjectedForm();

const postSubmit = () => {
  emit('saved');
};

setPostSubmitFunc(postSubmit);

const { t } = useI18n();

const title: ComputedRef<string> = computed(() =>
  get(editableItem)
    ? t('closed_trades.dialog.edit.title')
    : t('closed_trades.dialog.add.title')
);

const subtitle: ComputedRef<string> = computed(() =>
  get(editableItem) ? t('closed_trades.dialog.edit.subtitle') : ''
);
</script>

<template>
  <big-dialog
    :display="openDialog"
    :title="title"
    :subtitle="subtitle"
    :primary-action="t('common.actions.save')"
    :action-disabled="loading || submitting || !valid"
    :loading="loading || submitting"
    @confirm="trySubmit()"
    @cancel="closeDialog()"
  >
    <external-trade-form :edit="editableItem" />
  </big-dialog>
</template>
