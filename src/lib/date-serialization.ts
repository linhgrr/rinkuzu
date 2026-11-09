export function serializeDate(date: Date, fieldName: string): string {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new TypeError(`${fieldName} must be a valid Date`);
  }

  return date.toISOString();
}

export function serializeOptionalDate(
  date: Date | null | undefined,
  fieldName: string,
): string | undefined {
  return date == null ? undefined : serializeDate(date, fieldName);
}

export function toUtcDateKey(date: Date, fieldName: string): string {
  return serializeDate(date, fieldName).slice(0, 10);
}

// An ISO date-time with no `Z` or `±hh:mm` offset. `Date` reads these as local time.
const NAIVE_ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

/**
 * Marks an offset-less ISO date-time from an API as UTC by appending `Z`.
 * The adaptive API stores UTC but serialises it without an offset (RIN-1272).
 * Values that carry an offset, date-only values and non-dates are returned unchanged.
 */
export function assumeUtcWhenNoOffset(value: string): string {
  return NAIVE_ISO_DATE_TIME.test(value) ? `${value}Z` : value;
}
