<script setup lang="ts">
import { helpers, required } from '@vuelidate/validators';
import { toMessages } from '@/utils/validation';
import type { BigNumber } from '@rotki/common';
import type { BalanceSnapshotPayload } from '@/types/snapshots';

interface BalanceSnapshotPayloadAndLocation extends BalanceSnapshotPayload {
  location: string;
}

const props = withDefaults(
  defineProps<{
    edit?: boolean;
    form: BalanceSnapshotPayloadAndLocation;
    locations?: string[];
    previewLocationBalance?: Record<string, BigNumber> | null;
    timestamp: number;
  }>(),
  {
    edit: false,
    locations: () => [],
    previewLocationBalance: null,
  },
);

const emit = defineEmits<{
  (e: 'update:form', data: BalanceSnapshotPayloadAndLocation): void;
  (e: 'update:asset', asset: string): void;
}>();

const { t } = useI18n();
const { form } = toRefs(props);

const assetType = ref<string>('token');

const category = usePropVModel(props, 'form', 'category', emit);
const assetIdentifier = usePropVModel(props, 'form', 'assetIdentifier', emit);
const amount = usePropVModel(props, 'form', 'amount', emit);
const usdValue = usePropVModel(props, 'form', 'usdValue', emit);
const location = usePropVModel(props, 'form', 'location', emit);

function checkAssetType() {
  if (isNft(get(assetIdentifier)))
    set(assetType, 'nft');
}

watch(assetType, (assetType) => {
  if (assetType === 'nft')
    set(amount, '1');
});

const rules = {
  category: {
    required: helpers.withMessage(t('dashboard.snapshot.edit.dialog.balances.rules.category'), required),
  },
  asset: {
    required: helpers.withMessage(t('dashboard.snapshot.edit.dialog.balances.rules.asset'), required),
  },
  amount: {
    required: helpers.withMessage(t('dashboard.snapshot.edit.dialog.balances.rules.amount'), required),
  },
  usdValue: {
    required: helpers.withMessage(t('dashboard.snapshot.edit.dialog.balances.rules.value'), required),
  },
};

const { setValidation } = useEditBalancesSnapshotForm();

const v$ = setValidation(
  rules,
  {
    category,
    asset: assetIdentifier,
    amount,
    usdValue,
  },
  {
    $autoDirty: true,
  },
);

function updateAsset(asset: string) {
  emit('update:asset', asset);
}

watchImmediate(form, () => {
  checkAssetType();
});
</script>

<template>
  <form class="flex flex-col gap-2">
    <BalanceTypeInput
      v-model="category"
      :label="t('common.category')"
      :error-messages="toMessages(v$.category)"
    />
    <div>
      <div class="text-rui-text-secondary text-caption">
        {{ t('common.asset') }}
      </div>
      <div>
        <RuiRadioGroup
          v-model="assetType"
          color="primary"
          inline
          :disabled="edit"
        >
          <RuiRadio
            :label="t('dashboard.snapshot.edit.dialog.balances.token')"
            value="token"
          />
          <RuiRadio
            :label="t('dashboard.snapshot.edit.dialog.balances.nft')"
            value="nft"
          />
        </RuiRadioGroup>
      </div>
    </div>

    <EditBalancesSnapshotAssetPriceForm
      v-model:asset="assetIdentifier"
      v-model:amount="amount"
      v-model:usd-value="usdValue"
      :timestamp="timestamp"
      :v$="v$"
      :disable-asset="edit"
      :nft="assetType === 'nft'"
      @update:asset="updateAsset($event)"
    />

    <EditBalancesSnapshotLocationSelector
      v-model="location"
      optional-show-existing
      :locations="locations"
      :preview-location-balance="previewLocationBalance"
    />
  </form>
</template>
