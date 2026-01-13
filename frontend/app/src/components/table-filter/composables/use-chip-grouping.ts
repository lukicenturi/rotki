import type { ComputedRef, Ref } from 'vue';
import type { Suggestion } from '@/types/filtering';

export type ChipDisplayType = 'normal' | 'grouped' | 'hidden';

const MAX_CHIPS_PER_KEY = 3;

interface UseChipGroupingReturn {
  expandedGroupKey: Ref<string | undefined>;
  groupedKeysCounts: ComputedRef<Record<string, number>>;
  groupedKeys: ComputedRef<Set<string>>;
  isKeyGrouped: (key: string) => boolean;
  getGroupedItemsForKey: (key: string) => Suggestion[];
  getChipDisplayType: (item: Suggestion) => ChipDisplayType;
  getGroupedOverflowCount: (key: string) => number;
  toggleGroupMenu: (key: string) => void;
  removeGroupedItem: (item: Suggestion) => void;
  removeAllItemsForKey: (key: string) => void;
}

export function useChipGrouping(
  selection: Ref<Suggestion[]>,
  updateMatches: (pairs: Suggestion[]) => void,
): UseChipGroupingReturn {
  const expandedGroupKey = ref<string>();

  const groupedKeysCounts = computed<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const item of get(selection)) {
      counts[item.key] = (counts[item.key] || 0) + 1;
    }
    return counts;
  });

  const groupedKeys = computed<Set<string>>(() => {
    const result = new Set<string>();
    const counts = get(groupedKeysCounts);
    for (const [key, count] of Object.entries(counts)) {
      if (count > MAX_CHIPS_PER_KEY)
        result.add(key);
    }
    return result;
  });

  function isKeyGrouped(key: string): boolean {
    return get(groupedKeys).has(key);
  }

  function getGroupedItemsForKey(key: string): Suggestion[] {
    return get(selection).filter(item => item.key === key);
  }

  function getChipDisplayType(item: Suggestion): ChipDisplayType {
    if (!isKeyGrouped(item.key))
      return 'normal';

    const items = getGroupedItemsForKey(item.key);
    if (items[0] === item)
      return 'grouped';

    return 'hidden';
  }

  function getGroupedOverflowCount(key: string): number {
    const total = get(groupedKeysCounts)[key] || 0;
    return total - 1; // Subtract 1 because we show the first item
  }

  function toggleGroupMenu(key: string): void {
    if (get(expandedGroupKey) === key) {
      set(expandedGroupKey, undefined);
    }
    else {
      set(expandedGroupKey, key);
    }
  }

  function removeGroupedItem(item: Suggestion): void {
    const newSelection = get(selection).filter(s => s !== item);
    updateMatches(newSelection);
  }

  function removeAllItemsForKey(key: string): void {
    const newSelection = get(selection).filter(s => s.key !== key);
    updateMatches(newSelection);
    set(expandedGroupKey, undefined);
  }

  return {
    expandedGroupKey,
    getChipDisplayType,
    getGroupedItemsForKey,
    getGroupedOverflowCount,
    groupedKeys,
    groupedKeysCounts,
    isKeyGrouped,
    removeAllItemsForKey,
    removeGroupedItem,
    toggleGroupMenu,
  };
}
