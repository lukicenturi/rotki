<script setup lang="ts">
import { useHistoryEventsApi } from '@/composables/api/history/events';
import InternalLink from '@/components/helper/InternalLink.vue';

const props = defineProps<{
  visible?: boolean;
}>();

const { getEvmEventStatus } = useHistoryEventsApi();

const { t } = useI18n();

const loading = ref(false);
const status = ref<any>(null);
const showBanner = ref(false);

const fetchStatus = async (): Promise<void> => {
  if (get(loading))
    return;

  set(loading, true);
  try {
    const response = await getEvmEventStatus();
    set(status, response);
    set(showBanner, response.shouldNotify);
  } catch (error: any) {
    console.error('Failed to fetch EVM event status:', error);
  } finally {
    set(loading, false);
  }
};

// Remove dismissBanner function since banner should always show when events are outdated

const getOutdatedChainsText = (): string => {
  const statusData = get(status);
  if (!statusData)
    return '';

  const outdatedChains = Object.keys(statusData.chainsStatus).filter(
    (chain: string) => statusData.chainsStatus[chain].hasOutdatedEvents,
  );

  const undecodedChains = Object.keys(statusData.undecodedTransactions);

  const allAffectedChains = [...new Set([...outdatedChains, ...undecodedChains])];

  if (allAffectedChains.length === 0)
    return '';

  if (allAffectedChains.length === 1)
    return allAffectedChains[0];

  if (allAffectedChains.length === 2)
    return `${allAffectedChains[0]} and ${allAffectedChains[1]}`;

  return `${allAffectedChains.slice(0, -1).join(', ')}, and ${allAffectedChains[allAffectedChains.length - 1]}`;
};

const getStatusMessage = (): string => {
  const statusData = get(status);
  if (!statusData)
    return '';

  const hasOutdated = Object.values(statusData.chainsStatus).some((chain: any) => chain.hasOutdatedEvents);
  const hasUndecoded = Object.keys(statusData.undecodedTransactions).length > 0;
  const chainsText = getOutdatedChainsText();

  if (hasOutdated && hasUndecoded) {
    return t('evm_event_status.banner_message_both', { chains: chainsText });
  } else if (hasOutdated) {
    return t('evm_event_status.banner_message_outdated', { chains: chainsText });
  } else if (hasUndecoded) {
    return t('evm_event_status.banner_message_undecoded', { chains: chainsText });
  }

  return '';
};

onMounted(async () => {
  await fetchStatus();
});

watch(() => props.visible, async (visible) => {
  if (visible)
    await fetchStatus();
});
</script>

<template>
  <div
    v-if="showBanner && !loading"
    class="px-4 py-3 text-body-1 flex items-center gap-2 border-b border-orange-400 bg-orange-50 dark:bg-orange-900/20 w-full"
  >
    <RuiIcon
      name="warning-line"
      class="text-orange-600 dark:text-orange-400"
      size="20"
    />
    <div class="text-orange-800 dark:text-orange-200">
      {{ getStatusMessage() }}
      <InternalLink
        to="/history/"
        class="font-semibold text-orange-700 dark:text-orange-300 hover:text-orange-900 dark:hover:text-orange-100 ml-1"
      >
        {{ t('evm_event_status.refresh_events_link') }}
      </InternalLink>
    </div>
  </div>
</template>