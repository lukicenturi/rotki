import type { TablePaginationData } from '@rotki/ui-library';
import type { ComputedRef, Ref } from 'vue';
import type { HistoryEventRequestPayload } from '@/modules/history/events/request-types';
import { startPromise } from '@shared/utils';
import { useHistoryEventsApi } from '@/composables/api/history/events';
import { Routes } from '@/router/routes';
import { useNotificationsStore } from '@/store/notifications';

export interface HistoryEventNavigationRequest {
  /** Group to navigate to (used for getHistoryEventGroupPosition API call) */
  targetGroupIdentifier: string;
  /** Event ID for selected asset movement highlight (warning/yellow) */
  highlightedAssetMovement?: number;
  /** Event ID for potential match highlight (success/green) */
  highlightedPotentialMatch?: number;
  /** Event ID for negative balance highlight (error/red) */
  highlightedNegativeBalanceEvent?: number;
  /** When true, preserve current route filters and calculate position within filtered view */
  preserveFilters?: boolean;
  /** Fallback requests to try when the target is not found in filtered results */
  fallbacks?: HistoryEventNavigationRequest[];
}

export interface HighlightTarget {
  identifier: number;
  groupIdentifier: string;
}

export type HighlightTargetType = 'assetMovement' | 'negativeBalance' | 'potentialMatch';

const historyEventsPath = Routes.HISTORY_EVENTS.toString();
const pendingNavigation = ref<HistoryEventNavigationRequest>();
const isNavigating = ref<boolean>(false);

const highlightTargets = ref<Partial<Record<HighlightTargetType, HighlightTarget>>>({});

export const useHistoryEventNavigation = createSharedComposable(() => {
  const router = useRouter();
  const route = useRoute();
  const { getHistoryEventGroupPosition } = useHistoryEventsApi();

  function requestNavigation(request: HistoryEventNavigationRequest): void {
    set(isNavigating, true);
    set(pendingNavigation, request);

    // If not on the history events page, navigate there first.
    // The consumer will pick up the pending request via watchImmediate when it mounts.
    if (!get(route).path.startsWith(historyEventsPath)) {
      startPromise(router.push({ path: historyEventsPath }));
    }
  }

  function consumeNavigation(): void {
    set(pendingNavigation, undefined);
    set(isNavigating, false);
  }

  function setHighlightTarget(type: HighlightTargetType, target: HighlightTarget): void {
    set(highlightTargets, { ...get(highlightTargets), [type]: target });
  }

  function clearHighlightTarget(type: HighlightTargetType): void {
    const current = { ...get(highlightTargets) };
    delete current[type];
    set(highlightTargets, current);
  }

  function clearAllHighlightTargets(): void {
    set(highlightTargets, {});
  }

  /**
   * Build a navigation request chain from stored highlight targets, using
   * highlights currently present in the route query. Priority: green > yellow > red.
   * Each candidate in the chain becomes a fallback for the previous one.
   * All requests use preserveFilters mode to keep current filters intact.
   */
  function renavigateHighlights(): void {
    const targets = get(highlightTargets);
    const routeQuery = get(route).query;

    const candidates: HistoryEventNavigationRequest[] = [];

    // Green (potential match) - highest priority
    if (routeQuery.highlightedPotentialMatch && targets.potentialMatch) {
      candidates.push({
        highlightedAssetMovement: targets.assetMovement?.identifier,
        highlightedPotentialMatch: targets.potentialMatch.identifier,
        preserveFilters: true,
        targetGroupIdentifier: targets.potentialMatch.groupIdentifier,
      });
    }

    // Yellow (asset movement)
    if (routeQuery.highlightedAssetMovement && targets.assetMovement) {
      candidates.push({
        highlightedAssetMovement: targets.assetMovement.identifier,
        preserveFilters: true,
        targetGroupIdentifier: targets.assetMovement.groupIdentifier,
      });
    }

    // Red (negative balance) - lowest priority
    if (routeQuery.highlightedNegativeBalanceEvent && targets.negativeBalance) {
      candidates.push({
        highlightedNegativeBalanceEvent: targets.negativeBalance.identifier,
        preserveFilters: true,
        targetGroupIdentifier: targets.negativeBalance.groupIdentifier,
      });
    }

    if (candidates.length === 0)
      return;

    const [primary, ...fallbacks] = candidates;
    requestNavigation({ ...primary, fallbacks: fallbacks.length > 0 ? fallbacks : undefined });
  }

  /**
   * Find the page containing the highest-priority highlighted event within the given filters.
   * Tries candidates in priority order (green > yellow > red).
   * Returns the 1-based page number, or -1 if no highlighted event is found.
   */
  async function findHighlightPage(
    filterPayload: HistoryEventRequestPayload,
    limit: number,
  ): Promise<number> {
    const targets = get(highlightTargets);
    const routeQuery = get(route).query;

    const candidates: string[] = [];

    if (routeQuery.highlightedPotentialMatch && targets.potentialMatch)
      candidates.push(targets.potentialMatch.groupIdentifier);

    if (routeQuery.highlightedAssetMovement && targets.assetMovement)
      candidates.push(targets.assetMovement.groupIdentifier);

    if (routeQuery.highlightedNegativeBalanceEvent && targets.negativeBalance)
      candidates.push(targets.negativeBalance.groupIdentifier);

    if (candidates.length === 0)
      return -1;

    for (const groupIdentifier of candidates) {
      try {
        const position = await getHistoryEventGroupPosition(groupIdentifier, filterPayload);
        if (position >= 0)
          return Math.floor(position / limit) + 1;
      }
      catch {
        // Position API failed for this candidate, try next
      }
    }

    return -1;
  }

  return {
    clearAllHighlightTargets,
    clearHighlightTarget,
    consumeNavigation,
    findHighlightPage,
    highlightTargets,
    isNavigating,
    pendingNavigation,
    renavigateHighlights,
    requestNavigation,
    setHighlightTarget,
  };
});

/**
 * Sets up watchers that consume pending navigation requests.
 * Should be called once from HistoryEventsView to handle navigation
 * from any producer (e.g., MatchAssetMovementsPinned, NegativeBalancesDialog, external packages).
 *
 * Supports two input channels:
 * 1. Composable-based: internal components call requestNavigation() directly
 * 2. Route-based: external packages push route with targetGroupIdentifier + highlight query params (e.g., highlightedNegativeBalanceEvent)
 */
export function useHistoryEventNavigationConsumer(
  pagination: ComputedRef<TablePaginationData>,
  pageParams?: ComputedRef<HistoryEventRequestPayload>,
  groupLoading?: Ref<boolean>,
): void {
  const { t } = useI18n({ useScope: 'global' });
  const router = useRouter();
  const route = useRoute();
  const { getHistoryEventGroupPosition } = useHistoryEventsApi();
  const { consumeNavigation, pendingNavigation, requestNavigation, setHighlightTarget } = useHistoryEventNavigation();
  const { notify } = useNotificationsStore();

  // Watch for route-based navigation from external packages
  watchImmediate(route, ({ query }) => {
    const { targetGroupIdentifier, highlightedNegativeBalanceEvent } = query;
    if (targetGroupIdentifier && highlightedNegativeBalanceEvent) {
      setHighlightTarget('negativeBalance', {
        groupIdentifier: targetGroupIdentifier.toString(),
        identifier: Number(highlightedNegativeBalanceEvent),
      });
      requestNavigation({
        highlightedNegativeBalanceEvent: Number(highlightedNegativeBalanceEvent),
        targetGroupIdentifier: targetGroupIdentifier.toString(),
      });
    }
  });

  /**
   * Clear all highlight query params from the current route.
   */
  async function clearHighlightsFromRoute(): Promise<void> {
    const { highlightedAssetMovement, highlightedNegativeBalanceEvent, highlightedPotentialMatch, ...remainingQuery } = get(route).query;
    if (highlightedAssetMovement || highlightedPotentialMatch || highlightedNegativeBalanceEvent) {
      await router.replace({ query: remainingQuery });
    }
  }

  /**
   * Build highlight query params from a navigation request.
   */
  function buildHighlightQuery(request: HistoryEventNavigationRequest, page: number): Record<string, string> {
    const query: Record<string, string> = { page: page.toString() };

    if (request.highlightedAssetMovement)
      query.highlightedAssetMovement = request.highlightedAssetMovement.toString();

    if (request.highlightedPotentialMatch)
      query.highlightedPotentialMatch = request.highlightedPotentialMatch.toString();

    if (request.highlightedNegativeBalanceEvent)
      query.highlightedNegativeBalanceEvent = request.highlightedNegativeBalanceEvent.toString();

    return query;
  }

  // Watch for composable-based navigation requests
  watchImmediate(pendingNavigation, async (request) => {
    if (!request)
      return;

    let currentRequest: HistoryEventNavigationRequest | undefined = request;

    try {
      while (currentRequest) {
        const filterPayload = currentRequest.preserveFilters && pageParams ? get(pageParams) : undefined;
        const position = await getHistoryEventGroupPosition(currentRequest.targetGroupIdentifier, filterPayload);

        // Check if this request is still current after the await
        if (get(pendingNavigation) !== request)
          return;

        if (position < 0) {
          // Target not in filtered results, try fallback
          if (currentRequest.fallbacks?.length) {
            const [next, ...remaining]: HistoryEventNavigationRequest[] = currentRequest.fallbacks;
            currentRequest = { ...next, fallbacks: remaining.length > 0 ? remaining : undefined };
            continue;
          }
          // No fallbacks left, clear highlights
          await clearHighlightsFromRoute();
          break;
        }

        const limit = get(pagination).limit;
        const page = Math.floor(position / limit) + 1;
        const highlightQuery = buildHighlightQuery(currentRequest, page);

        if (currentRequest.preserveFilters && groupLoading) {
          // Wait for the pagination system's loading cycle to complete.
          // The loading may not have started yet (fetchDebounce), so wait for it to start first.
          if (!get(groupLoading)) {
            await Promise.race([
              until(groupLoading).toBe(true),
              new Promise<void>(resolve => setTimeout(resolve, 500)),
            ]);
          }
          // Now wait for loading to finish
          if (get(groupLoading)) {
            await until(groupLoading).toBe(false);
          }

          // Check if this request is still current after waiting
          if (get(pendingNavigation) !== request)
            return;

          // Route now has the correct filter/limit values from the pagination system
          await router.push({
            force: true,
            path: historyEventsPath,
            query: { ...get(route).query, ...highlightQuery },
          });
        }
        else {
          await router.push({
            force: true,
            path: historyEventsPath,
            query: { limit: limit.toString(), ...highlightQuery },
          });
        }
        break;
      }
    }
    catch (error: any) {
      // Only show notification for user-initiated navigation, not filter-change re-navigation
      if (!request.preserveFilters) {
        notify({
          display: true,
          message: error.message,
          title: t('asset_movement_matching.dialog.show_in_events'),
        });
      }
    }
    finally {
      consumeNavigation();
    }
  });
}
