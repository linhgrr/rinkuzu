const vndCurrencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

export function formatVndCurrency(amount: number): string {
  return vndCurrencyFormatter.format(amount);
}

type DateInput = Date | string | number | null | undefined;
/**
 * The zone every rendered timestamp is pinned to.
 *
 * Exported because it was not, and three modules answered that by writing the
 * literal again while two more forgot a timeZone altogether and rendered in
 * whatever zone the viewer's browser happened to be in.
 */
export const DEFAULT_DATE_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export interface DateFormatOptions {
  locale?: string;
  emptyLabel?: string;
  options?: Intl.DateTimeFormatOptions;
}

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};

const DEFAULT_DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: DEFAULT_DATE_TIME_ZONE,
};

const MONTH_YEAR_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'long',
  year: 'numeric',
};

const SHORT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

const LONG_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
};

const LONG_DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

const UTC_DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
};

// Module-scoped formatters only — never construct Intl.* inside hot call paths.
const enDate = new Intl.DateTimeFormat('en-US', DEFAULT_DATE_OPTIONS);
const viDate = new Intl.DateTimeFormat('vi-VN', DEFAULT_DATE_OPTIONS);
const enDateTime = new Intl.DateTimeFormat('en-US', DEFAULT_DATE_TIME_OPTIONS);
const viDateTime = new Intl.DateTimeFormat('vi-VN', DEFAULT_DATE_TIME_OPTIONS);
const enMonthYear = new Intl.DateTimeFormat('en', MONTH_YEAR_OPTIONS);
const viMonthYear = new Intl.DateTimeFormat('vi', MONTH_YEAR_OPTIONS);
const enShortDate = new Intl.DateTimeFormat('en', SHORT_DATE_OPTIONS);
const viShortDate = new Intl.DateTimeFormat('vi', SHORT_DATE_OPTIONS);
const enLongDate = new Intl.DateTimeFormat('en', LONG_DATE_OPTIONS);
const viLongDate = new Intl.DateTimeFormat('vi', LONG_DATE_OPTIONS);
const enLongDateTime = new Intl.DateTimeFormat('en', LONG_DATE_TIME_OPTIONS);
const viLongDateTime = new Intl.DateTimeFormat('vi', LONG_DATE_TIME_OPTIONS);
const utcDateTime = new Intl.DateTimeFormat('en-US', UTC_DATE_TIME_OPTIONS);
const viUtcDateTime = new Intl.DateTimeFormat('vi-VN', UTC_DATE_TIME_OPTIONS);

function isVi(locale: string): boolean {
  return locale.startsWith('vi');
}

function toValidDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function resolveDateFormatter(
  locale: string,
  options?: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  if (!options) return isVi(locale) ? viDate : enDate;

  if (options.month === 'long' && options.year === 'numeric' && !options.day) {
    return isVi(locale) ? viMonthYear : enMonthYear;
  }
  if (options.month === 'short' && options.day === 'numeric' && options.year === 'numeric') {
    return isVi(locale) ? viShortDate : enShortDate;
  }
  if (options.month === 'long' && options.day === 'numeric' && options.year === 'numeric') {
    return isVi(locale) ? viLongDate : enLongDate;
  }

  return isVi(locale) ? viDate : enDate;
}

function resolveDateTimeFormatter(
  locale: string,
  options?: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  if (!options) return isVi(locale) ? viDateTime : enDateTime;

  if (options.timeZone === 'UTC') {
    return isVi(locale) ? viUtcDateTime : utcDateTime;
  }
  if (
    options.month === 'long' &&
    options.day === 'numeric' &&
    options.year === 'numeric' &&
    options.hour === '2-digit'
  ) {
    return isVi(locale) ? viLongDateTime : enLongDateTime;
  }

  return isVi(locale) ? viDateTime : enDateTime;
}

export function formatDate(
  value: DateInput,
  { locale = 'en-US', emptyLabel = 'N/A', options }: DateFormatOptions = {},
): string {
  const date = toValidDate(value);
  if (!date) return emptyLabel;

  return resolveDateFormatter(locale, options).format(date);
}

export function formatDateTime(
  value: DateInput,
  { locale = 'vi-VN', emptyLabel = 'N/A', options }: DateFormatOptions = {},
): string {
  const date = toValidDate(value);
  if (!date) return emptyLabel;

  return resolveDateTimeFormatter(locale, options).format(date);
}

const DAY_FIRST_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: DEFAULT_DATE_TIME_ZONE,
};

const SPELLED_MONTH_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  ...SHORT_DATE_OPTIONS,
  timeZone: DEFAULT_DATE_TIME_ZONE,
};

const viCalendarDate = new Intl.DateTimeFormat('vi-VN', DAY_FIRST_DATE_OPTIONS);
const enCalendarDate = new Intl.DateTimeFormat('en-US', SPELLED_MONTH_DATE_OPTIONS);

/**
 * A calendar date that reads unambiguously in the page locale: 02/11/2026 in
 * Vietnamese, Nov 2, 2026 in English. `formatDate` with no locale printed the
 * US 11/02/2026 on both locales, which a Vietnamese reader takes for 11 Feb.
 */
export function formatCalendarDate(value: DateInput, locale: string, emptyLabel = 'N/A'): string {
  const date = toValidDate(value);
  if (!date) return emptyLabel;

  return (isVi(locale) ? viCalendarDate : enCalendarDate).format(date);
}
