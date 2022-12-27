<script setup lang="ts">
import useVuelidate from '@vuelidate/core';
import { helpers, required } from '@vuelidate/validators';
import { type PropType } from 'vue';
import { useAddressesNamesStore } from '@/store/blockchain/accounts/addresses-names';
import {
  type AddressBookLocation,
  type AddressBookPayload
} from '@/types/eth-names';
import { sanitizeAddress, toSentenceCase } from '@/utils/text';
import ChainSelect from '@/components/accounts/blockchain/ChainSelect.vue';

const props = defineProps({
  value: {
    required: true,
    type: Object as PropType<AddressBookPayload>
  },
  edit: {
    required: true,
    type: Boolean
  },
  enableForAllChain: {
    required: false,
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['input', 'valid', 'update:enable-for-all-chain']);
const { t } = useI18n();
const { value, enableForAllChain } = toRefs(props);

const search = ref<string | null>('');

const addressesNamesStore = useAddressesNamesStore();
const { getFetchedAddressesList } = addressesNamesStore;
const { addressBookEntries } = toRefs(addressesNamesStore);

const addressBookList = computed<string[]>(() => {
  const items = get(addressBookEntries)[get(value).location];
  return items.map(item => item.address);
});

const addressSuggestions = computed<string[]>(() => {
  return get(getFetchedAddressesList(get(value).blockchain)).filter(
    (address: string) => !get(addressBookList).includes(address)
  );
});

const input = (payload: Partial<AddressBookPayload>) => {
  emit('input', { ...get(value), ...payload });
};

watch(search, address => {
  if (address === null) address = '';
  input({ address });
});

watch(value, ({ address }) => {
  const sanitizedAddress = sanitizeAddress(get(address));
  if (get(address) !== sanitizedAddress) {
    set(search, sanitizedAddress);
  }
});

const locations: AddressBookLocation[] = ['global', 'private'];

const rules = {
  address: {
    required: helpers.withMessage(
      t('address_book.form.validation.address').toString(),
      required
    )
  },
  name: {
    required: helpers.withMessage(
      t('address_book.form.validation.name').toString(),
      required
    )
  }
};

const v$ = useVuelidate(
  rules,
  {
    address: computed(() => get(value).address),
    name: computed(() => get(value).name)
  },
  { $autoDirty: true }
);

watch(v$, ({ $invalid }) => {
  emit('valid', !$invalid);
});

const updateAllChainState = (enable: boolean) => {
  emit('update:enable-for-all-chain', enable);
};
</script>

<template>
  <v-form :value="!v$.$invalid">
    <div class="mt-2">
      <div>
        <v-select
          :value="value.location"
          outlined
          :label="t('common.location')"
          :items="locations"
          :disabled="edit"
          @input="input({ location: $event })"
        >
          <template #item="{ item }"> {{ toSentenceCase(item) }} </template>
          <template #selection="{ item }">
            {{ toSentenceCase(item) }}
          </template>
        </v-select>
      </div>
      <div>
        <chain-select
          :value="value.blockchain"
          :disabled="edit || enableForAllChain"
          @input="input({ blockchain: $event })"
        />
        <v-checkbox
          :disabled="edit"
          class="mt-0"
          :input-value="enableForAllChain"
          :label="t('address_book.form.labels.for_all_chain')"
          @change="updateAllChainState"
        />
      </div>
      <div>
        <v-combobox
          :value="value.address"
          outlined
          :label="t('address_book.form.labels.address')"
          :items="addressSuggestions"
          :no-data-text="t('address_book.form.no_suggestions_available')"
          :disabled="edit"
          :error-messages="v$.address.$errors.map(e => e.$message)"
          :search-input.sync="search"
          @input="input({ address: $event })"
        />
      </div>
      <div>
        <v-text-field
          :value="value.name"
          outlined
          :label="t('common.name')"
          :error-messages="v$.name.$errors.map(e => e.$message)"
          @input="input({ name: $event })"
        />
      </div>
    </div>
  </v-form>
</template>
