/**
 * Epoch timestamps reach the presentation layer in two units.
 *
 * Some payloads carry milliseconds and some carry seconds, and the rule for
 * telling them apart -- a value below 10^12 is seconds, because 10^12 ms is
 * September 2001 and 10^12 s is the year 33658 -- was written out four times:
 * twice in dashboard mappers, once in an adaptive hook, once inline in a
 * sidebar component. Two of those copies validated their input and two did
 * not, so the same bad value became `null` in one dashboard and `NaN` in the
 * other.
 *
 * One definition, so the threshold and the validation move together.
 */
const SECONDS_UPPER_BOUND = 1_000_000_000_000;

/**
 * A timestamp in milliseconds, or `null` when the value cannot be one.
 *
 * Zero and negatives are rejected rather than normalised: they mean "absent"
 * in every payload this reads, never "the Unix epoch".
 */
export function toTimestampMs(value?: number | null): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;

  return value < SECONDS_UPPER_BOUND ? value * 1000 : value;
}
