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
