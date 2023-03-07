import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isToday from 'dayjs/plugin/isToday';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { DateFormat } from '@/types/date-format';
import { MaybeRef } from '@vueuse/core';

export function getDateInputISOFormat(format: DateFormat): string {
  return {
    [DateFormat.DateMonthYearHourMinuteSecondTimezone]: 'DD/MM/YYYY',
    [DateFormat.DateMonthYearHourMinuteSecond]: 'DD/MM/YYYY',
    [DateFormat.MonthDateYearHourMinuteSecond]: 'MM/DD/YYYY',
    [DateFormat.YearMonthDateHourMinuteSecond]: 'YYYY/MM/DD'
  }[format];
}

export function changeDateFormat(
  date: string,
  fromFormat: DateFormat,
  toFormat: DateFormat
): string {
  if (!date) {
    return '';
  }

  const seconds = date.charAt(date.length - 6) === ':';
  const timestamp = convertToTimestamp(date, fromFormat);

  return convertFromTimestamp(timestamp, seconds, toFormat);
}

export function convertToTimestamp(
  date: MaybeRef<string>,
  dateFormat: MaybeRef<DateFormat> = DateFormat.DateMonthYearHourMinuteSecond
): number {
  let format: string = getDateInputISOFormat(get(dateFormat));
  const dateVal = get(date);
  if (dateVal.includes(' ')) {
    format += ' HH:mm';
    if (dateVal.charAt(dateVal.length - 6) === ':') {
      format += ':ss';
    }
  }

  return dayjs(dateVal, format).unix();
}

export function convertFromTimestamp(
  timestamp: MaybeRef<number>,
  seconds: MaybeRef<boolean> = false,
  dateFormat: MaybeRef<DateFormat> = DateFormat.DateMonthYearHourMinuteSecond
): string {
  const time = dayjs(get(timestamp) * 1000);
  let format: string = getDateInputISOFormat(get(dateFormat));
  if (time.hour() !== 0 || time.minute() !== 0) {
    format += ' HH:mm';
    if (get(seconds)) {
      format += ':ss';
    }
  }

  return time.format(format);
}

export function convertDateByTimezone(
  date: string,
  dateFormat: DateFormat = DateFormat.DateMonthYearHourMinuteSecond,
  fromTimezone: string,
  toTimezone: string
): string {
  if (!date) {
    return date;
  }

  fromTimezone = fromTimezone || dayjs.tz.guess();
  toTimezone = toTimezone || dayjs.tz.guess();

  let format: string = getDateInputISOFormat(dateFormat);
  if (date.includes(' ')) {
    format += ' HH:mm';
    if (date.charAt(date.length - 6) === ':') {
      format += ':ss';
    }
  }

  return dayjs.tz(date, format, fromTimezone).tz(toTimezone).format(format);
}

export function isValidDate(date: string, dateFormat: string): boolean {
  if (!date) {
    return false;
  }
  return dayjs(date, dateFormat, true).isValid();
}

export function setupDayjs(): void {
  dayjs.extend(customParseFormat);
  dayjs.extend(utc);
  dayjs.extend(timezone);
  dayjs.extend(localizedFormat);
  dayjs.extend(isToday);
  dayjs.tz.guess();
}
