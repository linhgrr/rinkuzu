/**
 * ISO-8601 week arithmetic in UTC.
 *
 * Weeks start Monday 00:00:00.000 UTC and end Sunday 23:59:59.999 UTC. Week 1
 * of an ISO year is the week holding that year's first Thursday, so the ISO
 * year of a late-December or early-January day can differ from its calendar
 * year (2027-01-01 is in 2026-W53).
 */

export const DAY_MS = 86_400_000;
export const WEEK_MS = 7 * DAY_MS;

export interface IsoWeekWindow {
  /** e.g. `2026-W44`. */
  readonly isoWeek: string;
  /** Monday 00:00:00.000 UTC, inclusive. */
  readonly start: Date;
  /** The next Monday 00:00:00.000 UTC, exclusive. */
  readonly endExclusive: Date;
}

/** Monday 00:00 UTC of the ISO week containing `date`. */
export function isoWeekStart(date: Date): Date {
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  // getUTCDay: Sunday = 0. Shift so Monday = 0 … Sunday = 6.
  const daysSinceMonday = (new Date(midnight).getUTCDay() + 6) % 7;
  return new Date(midnight - daysSinceMonday * DAY_MS);
}

/** `YYYY-Www` label of the ISO week containing `date`. */
export function isoWeekLabel(date: Date): string {
  const thursday = new Date(isoWeekStart(date).getTime() + 3 * DAY_MS);
  const isoYear = thursday.getUTCFullYear();
  const firstThursdayWeekStart = isoWeekStart(new Date(Date.UTC(isoYear, 0, 4)));
  const week = Math.round((thursday.getTime() - firstThursdayWeekStart.getTime()) / WEEK_MS) + 1;
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/**
 * The last `count` ISO weeks, oldest first, ending with the (partial) week
 * that contains `now`.
 */
export function trailingIsoWeeks(now: Date, count: number): IsoWeekWindow[] {
  const current = isoWeekStart(now).getTime();
  return Array.from({ length: count }, (_, index) => {
    const start = new Date(current - (count - 1 - index) * WEEK_MS);
    return {
      isoWeek: isoWeekLabel(start),
      start,
      endExclusive: new Date(start.getTime() + WEEK_MS),
    };
  });
}
