<script setup lang="ts">
import { type GeneralAccount } from '@rotki/common/lib/account';
import { type PropType } from 'vue';
import { truncateAddress } from '@/filters';
import { useAddressesNamesStore } from '@/store/blockchain/accounts/addresses-names';
import { useSessionSettingsStore } from '@/store/settings/session';
import { randomHex } from '@/utils/data';

const AssetIcon = defineAsyncComponent(
  () => import('@/components/helper/display/icons/AssetIcon.vue')
);

const props = defineProps({
  account: { required: true, type: Object as PropType<GeneralAccount> },
  useAliasName: { required: false, type: Boolean, default: true },
  truncate: { required: false, type: Boolean, default: true }
});

const { account, useAliasName } = toRefs(props);
const { scrambleData, shouldShowAmount } = storeToRefs(
  useSessionSettingsStore()
);

const { addressNameSelector } = useAddressesNamesStore();

const address = computed<string>(() => {
  if (!get(scrambleData)) {
    return get(account).address;
  }
  return randomHex();
});

const aliasName = computed<string | null>(() => {
  if (!get(scrambleData) && get(useAliasName)) {
    return get(addressNameSelector(get(account).address, get(account).chain));
  }

  return null;
});

const { tc } = useI18n();
</script>

<template>
  <v-tooltip top open-delay="400" :disabled="!truncate">
    <template #activator="{ on }">
      <v-row align="center" no-gutters class="flex-nowrap" v-on="on">
        <v-col cols="auto" class="pr-2">
          <v-avatar left size="28px" class="mr-0">
            <asset-icon
              v-if="account.chain"
              size="24px"
              :identifier="account.chain"
            />
            <v-tooltip v-else top>
              <template #activator="{ on }">
                <v-icon v-on="on"> mdi-link-variant </v-icon>
              </template>
              <span>{{ tc('common.multi_chain') }}</span>
            </v-tooltip>
          </v-avatar>
        </v-col>

        <v-col
          cols="auto"
          :class="{ 'blur-content': !shouldShowAmount }"
          class="text-no-wrap"
        >
          <div v-if="aliasName">{{ aliasName }}</div>
          <div v-else>
            {{ truncate ? truncateAddress(address, 6) : address }}
          </div>
        </v-col>
      </v-row>
    </template>
    <div>
      {{ account.address }}
    </div>
  </v-tooltip>
</template>

<style scoped lang="scss">
.blur-content {
  filter: blur(0.75em);
}

.account-display {
  &__label {
    > span {
      display: inline-block;
      text-overflow: clip;
      padding-top: 6px;
      line-height: 20px;
      max-width: 180px;
    }
  }
}
</style>
