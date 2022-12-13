import isEqual from 'lodash/isEqual';
import { type Ref } from 'vue';
import { useLedgerActionsApi } from '@/services/history/ledger-actions';
import { useAssociatedLocationsStore } from '@/store/history/associated-locations';
import { type LedgerActionEntry } from '@/store/history/types';
import {
  defaultHistoricPayloadState,
  mapCollectionEntriesWithMeta
} from '@/store/history/utils';
import { useNotificationsStore } from '@/store/notifications';
import { useTasks } from '@/store/tasks';
import { type ActionStatus } from '@/store/types';
import { type Collection, type CollectionResponse } from '@/types/collection';
import { type SupportedExchange } from '@/types/exchanges';
import {
  type LedgerAction,
  LedgerActionCollectionResponse,
  type LedgerActionRequestPayload,
  type NewLedgerAction
} from '@/types/history/ledger-actions';
import { type EntryWithMeta } from '@/types/history/meta';
import { type TradeLocation } from '@/types/history/trade-location';
import { Section, Status } from '@/types/status';
import { type TaskMeta } from '@/types/task';
import { TaskType } from '@/types/task-type';
import { useTradeLocations } from '@/types/trades';
import {
  defaultCollectionState,
  mapCollectionResponse
} from '@/utils/collection';
import { logger } from '@/utils/logging';

export const useLedgerActions = defineStore('history/ledgerActions', () => {
  const ledgerActions = ref(defaultCollectionState<LedgerActionEntry>()) as Ref<
    Collection<LedgerActionEntry>
  >;

  const ledgerActionsPayload: Ref<Partial<LedgerActionRequestPayload>> = ref(
    defaultHistoricPayloadState<LedgerAction>()
  );

  const { fetchAssociatedLocations } = useAssociatedLocationsStore();
  const { exchangeName } = useTradeLocations();
  const { tc } = useI18n();
  const { notify } = useNotificationsStore();

  const api = useLedgerActionsApi();

  const fetchLedgerActions = async (
    refresh = false,
    onlyLocation?: SupportedExchange
  ): Promise<void> => {
    const { awaitTask, isTaskRunning } = useTasks();
    const { setStatus, loading, isFirstLoad, resetStatus } = useStatusUpdater(
      Section.LEDGER_ACTIONS,
      !!onlyLocation
    );
    const taskType = TaskType.LEDGER_ACTIONS;

    const fetchLedgerActionsHandler = async (
      onlyCache: boolean,
      parameters?: Partial<LedgerActionRequestPayload>
    ): Promise<Collection<LedgerActionEntry>> => {
      const defaults: LedgerActionRequestPayload = {
        limit: 1,
        offset: 0,
        ascending: [false],
        orderByAttributes: ['timestamp'],
        onlyCache
      };

      const payload: LedgerActionRequestPayload = Object.assign(
        defaults,
        parameters ?? get(ledgerActionsPayload)
      );

      if (onlyCache) {
        const result = await api.getLedgerActions(payload);
        return mapCollectionEntriesWithMeta<LedgerAction>(
          mapCollectionResponse(result)
        ) as Collection<LedgerActionEntry>;
      }

      const { taskId } = await api.getLedgerActionsTask(payload);
      const location = parameters?.location ?? '';
      const exchange = location
        ? exchangeName(location as TradeLocation)
        : tc('actions.ledger_actions.all_exchanges');
      const taskMeta = {
        title: tc('actions.ledger_actions.task.title'),
        description: tc('actions.ledger_actions.task.description', undefined, {
          exchange
        }),
        location
      };

      const { result } = await awaitTask<
        CollectionResponse<EntryWithMeta<LedgerAction>>,
        TaskMeta
      >(taskId, taskType, taskMeta, true);

      setStatus(
        get(isTaskRunning(taskType)) ? Status.REFRESHING : Status.LOADED
      );

      const parsedResult = LedgerActionCollectionResponse.parse(result);
      return mapCollectionEntriesWithMeta<LedgerAction>(
        mapCollectionResponse(parsedResult)
      ) as Collection<LedgerActionEntry>;
    };

    try {
      const firstLoad = isFirstLoad();
      const onlyCache = firstLoad ? false : !refresh;
      if ((get(isTaskRunning(taskType)) || loading()) && !onlyCache) {
        return;
      }

      if (firstLoad || refresh) {
        await fetchAssociatedLocations();
      }

      const fetchOnlyCache = async (): Promise<void> => {
        set(ledgerActions, await fetchLedgerActionsHandler(true));
      };

      setStatus(firstLoad ? Status.LOADING : Status.REFRESHING);

      if (!onlyLocation) await fetchOnlyCache();

      if (!onlyCache || onlyLocation) {
        setStatus(Status.REFRESHING);

        const exchange = onlyLocation
          ? exchangeName(onlyLocation as TradeLocation)
          : tc('actions.ledger_actions.all_exchanges');

        await fetchLedgerActionsHandler(false, {
          location: onlyLocation
        }).catch(error => {
          notify({
            title: tc('actions.ledger_actions.error.title', undefined, {
              exchange
            }),
            message: tc('actions.ledger_actions.error.description', undefined, {
              exchange,
              error
            }),
            display: true
          });
        });

        if (!onlyLocation) await fetchOnlyCache();
      }

      setStatus(
        get(isTaskRunning(taskType)) ? Status.REFRESHING : Status.LOADED
      );
    } catch (e) {
      logger.error(e);
      resetStatus();
    }
  };

  const updateLedgerActionsPayload = async (
    newPayload: Partial<LedgerActionRequestPayload>
  ): Promise<void> => {
    if (!isEqual(get(ledgerActionsPayload), newPayload)) {
      set(ledgerActionsPayload, newPayload);
      await fetchLedgerActions();
    }
  };

  const addLedgerAction = async (
    ledgerAction: NewLedgerAction
  ): Promise<ActionStatus> => {
    let success = false;
    let message = '';
    try {
      await api.addLedgerAction(ledgerAction);
      success = true;
    } catch (e: any) {
      message = e.message;
    }

    await Promise.all([fetchAssociatedLocations(), fetchLedgerActions()]);
    return { success, message };
  };

  const editLedgerAction = async (
    ledgerAction: LedgerActionEntry
  ): Promise<ActionStatus> => {
    let success = false;
    let message = '';
    try {
      await api.editLedgerAction(ledgerAction);
      success = true;
    } catch (e: any) {
      message = e.message;
    }

    await Promise.all([fetchAssociatedLocations(), fetchLedgerActions()]);
    return { success, message };
  };

  const deleteLedgerAction = async (
    identifiers: number[]
  ): Promise<ActionStatus> => {
    let success = false;
    let message = '';
    try {
      success = await api.deleteLedgerAction(identifiers);
    } catch (e: any) {
      message = e.message;
    }

    await Promise.all([fetchAssociatedLocations(), fetchLedgerActions()]);
    return { success, message };
  };

  return {
    ledgerActions,
    ledgerActionsPayload,
    updateLedgerActionsPayload,
    fetchLedgerActions,
    addLedgerAction,
    editLedgerAction,
    deleteLedgerAction
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useLedgerActions, import.meta.hot));
}
