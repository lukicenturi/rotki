<script setup lang="ts">
import { BlockchainRefreshButtonBehaviour } from '@/types/settings/frontend-settings';

const { blockchainRefreshButtonBehaviour } = storeToRefs(
  useFrontendSettingsStore(),
);

const { t } = useI18n();
</script>

<template>
  <div class="p-2">
    <div class="font-bold uppercase p-2 text-sm">
      {{ t('dashboard.blockchain_balances.behaviour.title') }}:
    </div>
    <div class="pb-2 px-3">
      <SettingsOption
        #default="{ updateImmediate }"
        setting="blockchainRefreshButtonBehaviour"
        frontend-setting
      >
        <RuiRadioGroup
          :model-value="blockchainRefreshButtonBehaviour"
          color="primary"
          class="mt-0"
          hide-details
          @update:model-value="updateImmediate($event)"
        >
          <RuiRadio
            :model-value="BlockchainRefreshButtonBehaviour.ONLY_REFRESH_BALANCES.toString()"
            :label="t('dashboard.blockchain_balances.behaviour.only_refresh_balances')"
          />
          <RuiRadio
            :model-value="BlockchainRefreshButtonBehaviour.REDETECT_TOKENS.toString()"
            :label="t('dashboard.blockchain_balances.behaviour.redetect_tokens')"
          />
        </RuiRadioGroup>
      </SettingsOption>
    </div>
  </div>
</template>
