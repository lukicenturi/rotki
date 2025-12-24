import type { MessageHandler } from '../interfaces';
import type { ServiceRateLimitedData } from '@/modules/messaging/types';
import { NotificationCategory, NotificationGroup, Priority, Severity } from '@rotki/common';
import { displayDateFormatter } from '@/data/date-formatter';
import { createStateWithNotificationHandler } from '@/modules/messaging/utils';
import { useNotificationsStore } from '@/store/notifications';
import { useGeneralSettingsStore } from '@/store/settings/general';

interface RateLimitState extends Record<string, unknown> {
  count: number;
  endpoints: string[];
  until: number;
}

export function createServiceRateLimitedHandler(
  t: ReturnType<typeof useI18n>['t'],
): MessageHandler<ServiceRateLimitedData> {
  const notificationsStore = useNotificationsStore();
  const { data: notifications } = storeToRefs(notificationsStore);
  const { dateDisplayFormat } = useGeneralSettingsStore();

  return createStateWithNotificationHandler<ServiceRateLimitedData, RateLimitState>(
    async (data: ServiceRateLimitedData) => {
      const existingNotification = get(notifications).find(({ group }) => group === NotificationGroup.SERVICE_RATE_LIMITED);
      const existingExtras = existingNotification?.extras as RateLimitState | undefined;

      const existingEndpoints = existingExtras?.endpoints || [];
      const newEndpoints = existingEndpoints.includes(data.endpoint)
        ? existingEndpoints
        : [...existingEndpoints, data.endpoint];

      return {
        count: (existingExtras?.count || 0) + 1,
        endpoints: newEndpoints,
        until: data.until,
      };
    },
    async (data: ServiceRateLimitedData, state: RateLimitState) => ({
      category: NotificationCategory.BEACONCHAIN,
      display: true,
      extras: state,
      group: NotificationGroup.SERVICE_RATE_LIMITED,
      groupCount: state.count,
      message: t(
        'notification_messages.service_rate_limited.message',
        {
          endpoints: state.endpoints.map(item => `- ${item}`).join('\n'),
          service: data.service,
          until: displayDateFormatter.format(new Date(state.until * 1000), get(dateDisplayFormat)),
        },
      ),
      priority: Priority.BULK,
      severity: Severity.WARNING,
      title: t('notification_messages.service_rate_limited.title', { service: data.service }),
    }),
  );
}
