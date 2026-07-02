export function requireFirstNonEmptyString(fieldName: string, ...values: string[]): string {
  const value = values.find((candidate) => candidate.trim().length > 0);
  if (!value) {
    throw new TypeError(`${fieldName} must include at least one non-empty string`);
  }
  return value;
}
