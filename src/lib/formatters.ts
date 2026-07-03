const vndCurrencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

export function formatVndCurrency(amount: number): string {
  return vndCurrencyFormatter.format(amount);
}

type DateInput = Date | string | number | null | undefined;

export interface DateFormatOptions {
  locale?: string;
  emptyLabel?: string;
  options?: Intl.DateTimeFormatOptions;
}

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const cacheKey = `${locale}:${JSON.stringify(options)}`;
  const cached = dateFormatterCache.get(cacheKey);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat(locale, options);
  dateFormatterCache.set(cacheKey, formatter);
  return formatter;
}

function toValidDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatDate(
  value: DateInput,
  { locale = 'en-US', emptyLabel = 'N/A', options }: DateFormatOptions = {},
): string {
  const date = toValidDate(value);
  if (!date) return emptyLabel;

  return getDateFormatter(
    locale,
    options ?? {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    },
  ).format(date);
}

export function formatDateTime(
  value: DateInput,
  { locale = 'vi-VN', emptyLabel = 'N/A', options }: DateFormatOptions = {},
): string {
  const date = toValidDate(value);
  if (!date) return emptyLabel;

  return getDateFormatter(
    locale,
    options ?? {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(date);
}
