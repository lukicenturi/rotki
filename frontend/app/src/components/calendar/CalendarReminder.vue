<script setup lang="ts">
import type { CalendarEvent, CalendarReminderTemporaryPayload } from '@/types/history/calendar';

const props = defineProps<{
  editableItem?: CalendarEvent;
}>();

const { editableItem } = toRefs(props);

const { t } = useI18n();

const showReminders: Ref<boolean> = ref(false);

const temporaryData: Ref<CalendarReminderTemporaryPayload[]> = ref([]);

function addReminder() {
  const newData = {
    seconds: 15 * 60,
    identifier: Date.now().toString(),
    isTemporary: true,
  };

  set(temporaryData, [
    ...get(temporaryData),
    newData,
  ]);

  set(showReminders, true);
}

function toggleReminder() {
  if (get(temporaryData).length > 0)
    set(showReminders, !get(showReminders));
}

function deleteData(index: number) {
  if (!get(editableItem)) {
    const temp = [...get(temporaryData)];
    temp.splice(index, 1);
    set(temporaryData, temp);
  }
}

function updateData(index: number, value: number) {
  if (!get(editableItem)) {
    const temp = [...get(temporaryData)];
    temp[index].seconds = value;
    set(temporaryData, temp);
  }
}
</script>

<template>
  <div class="border-y border-default">
    <div class="py-4 flex justify-between items-center">
      <RuiButton
        variant="text"
        :class="{
          'hover:!bg-transparent active:!bg-transparent cursor-default': temporaryData.length === 0,
        }"
        @click="toggleReminder()"
      >
        <div class="flex gap-4">
          <div>{{ t('calendar.reminder.title') }}</div>
          <RuiBadge
            color="secondary"
            :text="temporaryData.length.toString()"
            placement="center"
            size="sm"
          />
          <RuiIcon
            v-if="temporaryData.length > 0"
            class="ml-2"
            :name="showReminders ? 'arrow-down-s-line' : 'arrow-up-s-line'"
          />
        </div>
      </RuiButton>
      <RuiButton
        color="secondary"
        size="sm"
        @click="addReminder()"
      >
        {{ t('calendar.reminder.add_reminder') }}
      </RuiButton>
    </div>
    <RuiAccordions :value="showReminders ? 0 : -1">
      <RuiAccordion
        eager
      >
        <template #default>
          <div
            v-if="temporaryData.length > 0"
            class="flex flex-col gap-4 pt-2 pb-4"
          >
            <CalendarReminderEntry
              v-for="(data, index) in temporaryData"
              :key="data.seconds + data.identifier"
              :value="data.seconds"
              @delete="deleteData(index)"
              @input="updateData(index, $event)"
            />
          </div>
        </template>
      </RuiAccordion>
    </RuiAccordions>
  </div>
</template>
