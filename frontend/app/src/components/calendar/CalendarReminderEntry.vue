<script setup lang="ts">
import { helpers, required } from '@vuelidate/validators';
import useVuelidate from '@vuelidate/core';
import { toMessages } from '@/utils/validation';

const props = defineProps<{
  value: number;
}>();

const emit = defineEmits<{
  (e: 'input', value: number): void;
  (e: 'delete'): void;
}>();

const { value } = toRefs(props);

const { t } = useI18n();

enum Unit {
  MINUTES = 'minutes',
  HOURS = 'hours',
  DAYS = 'days',
  WEEKS = 'weeks',
}

interface UnitData {
  key: Unit;
  label: string;
  seconds: number;
};

const unitData: ComputedRef<UnitData[]> = computed(() => ([
  {
    key: Unit.MINUTES,
    label: t('calendar.reminder.units.minutes'),
    seconds: 60,
  },
  {
    key: Unit.HOURS,
    label: t('calendar.reminder.units.hours'),
    seconds: 60 * 60,
  },
  {
    key: Unit.DAYS,
    label: t('calendar.reminder.units.days'),
    seconds: 60 * 60 * 24,
  },
  {
    key: Unit.WEEKS,
    label: t('calendar.reminder.units.weeks'),
    seconds: 60 * 60 * 24 * 7,
  },
]));

const rules = {
  amount: {
    required: helpers.withMessage(
      'The amount field should not be empty',
      required,
    ),
  },
  unit: {
    required: helpers.withMessage(
      'The unit field should not be empty',
      required,
    ),
  },
};

const amount: Ref<string> = ref('1');
const unit: Ref<Unit> = ref(Unit.HOURS);

const v$ = useVuelidate(
  rules,
  {
    amount,
    unit,
  },
  {
    $autoDirty: true,
  },
);

function calculateCurrentSeconds(): number {
  const item = get(unitData).find(item => item.key === get(unit));

  if (item)
    return Number(get(amount)) * item.seconds;

  return 0;
}

function calculateAmountAndUnit(seconds: number) {
  const unitDataVal = get(unitData);

  let unit: Unit = Unit.MINUTES;
  let amount = Math.floor(seconds / 60);

  unitDataVal.reverse().find((item) => {
    const tempAmount = seconds / item.seconds;
    if (tempAmount % 1 === 0) {
      unit = item.key;
      amount = tempAmount;
      return true;
    }

    return false;
  });

  return {
    unit,
    amount,
  };
}

watchImmediate(value, (seconds) => {
  const currentSeconds = calculateCurrentSeconds();

  if (seconds !== currentSeconds) {
    const { unit: tempUnit, amount: tempAmount } = calculateAmountAndUnit(seconds);

    set(unit, tempUnit);
    set(amount, tempAmount.toString());
  }
});

function triggerUpdate() {
  const amountVal = get(amount);
  const unitVal = get(unit);

  if (amountVal && unitVal) {
    const currentSeconds = calculateCurrentSeconds();

    emit('input', currentSeconds);
  }
}
</script>

<template>
  <div class="flex gap-4">
    <AmountInput
      v-model="amount"
      label="Amount"
      integer
      variant="outlined"
      :error-messages="toMessages(v$.amount)"
      hide-details
      dense
      autofocus
      @blur="triggerUpdate()"
    />
    <div
      class="w-[10rem]"
    >
      <RuiMenuSelect
        v-model="unit"
        label="Unit"
        :options="unitData"
        variant="outlined"
        float-label
        full-width
        key-attr="key"
        dense
        :error-messages="toMessages(v$.unit)"
        @input="triggerUpdate()"
      />
    </div>

    <div class="pt-2 text-rui-text-secondary text-sm">
      {{ t('calendar.reminder.before_event') }}
    </div>
    <div>
      <RuiButton
        icon
        color="error"
        variant="text"
        class="!p-2"
        @click="emit('delete')"
      >
        <RuiIcon
          size="20"
          name="delete-bin-line"
        />
      </RuiButton>
    </div>
  </div>
</template>
