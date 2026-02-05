import type { TablePaginationData } from '@rotki/ui-library';
import type { ComputedRef } from 'vue';
import { useHistoryEventsApi } from '@/composables/api/history/events';
import { Routes } from '@/router/routes';
import { useNotificationsStore } from '@/store/notifications';

export interface HistoryEventNavigationRequest {
  /** Group to navigate to (used for getHistoryEventGroupPosition API call) */
  groupIdentifier: string;
  /** Event ID for yellow (warning) highlight */
  highlightedIdentifier?: number;
  /** Event ID for green (success) highlight */
  highlightedPotentialMatch?: number;
  /** Event ID for negative balance danger highlight */
  negativeBalanceEvent?: number;
}

const pendingNavigation = ref<HistoryEventNavigationRequest>();
const isNavigating = ref<boolean>(false);

export const useHistoryEventNavigation = createSharedComposable(() => {
  function requestNavigation(request: HistoryEventNavigationRequest): void {
    set(isNavigating, true);
    set(pendingNavigation, request);
  }

  function consumeNavigation(): void {
    set(pendingNavigation, undefined);
    set(isNavigating, false);
  }

  return { consumeNavigation, isNavigating, pendingNavigation, requestNavigation };
});

/**
 * Sets up a watcher that consumes pending navigation requests.
 * Should be called once from HistoryEventsView to handle navigation
 * from any producer (e.g., MatchAssetMovementsPinned, NegativeBalancesDialog).
 */
export function useHistoryEventNavigationConsumer(pagination: ComputedRef<TablePaginationData>): void {
  const { t } = useI18n({ useScope: 'global' });
  const router = useRouter();
  const { getHistoryEventGroupPosition } = useHistoryEventsApi();
  const { consumeNavigation, pendingNavigation } = useHistoryEventNavigation();
  const { notify } = useNotificationsStore();

  watchImmediate(pendingNavigation, async (request) => {
    if (!request)
      return;

    try {
      const position = await getHistoryEventGroupPosition(request.groupIdentifier);
      // Check if this request is still current after the await
      if (get(pendingNavigation) !== request)
        return;

      const limit = get(pagination).limit;
      const page = Math.floor(position / limit) + 1;

      const query: Record<string, string> = {
        limit: limit.toString(),
        page: page.toString(),
      };

      if (request.highlightedIdentifier)
        query.highlightedIdentifier = request.highlightedIdentifier.toString();

      if (request.highlightedPotentialMatch)
        query.highlightedPotentialMatch = request.highlightedPotentialMatch.toString();

      if (request.negativeBalanceEvent)
        query.negativeBalanceEvent = request.negativeBalanceEvent.toString();

      await router.push({
        force: true,
        path: Routes.HISTORY_EVENTS.toString(),
        query,
      });
    }
    catch (error: any) {
      notify({
        display: true,
        message: error.message,
        title: t('asset_movement_matching.dialog.show_in_events'),
      });
    }
    finally {
      consumeNavigation();
    }
  });
}
