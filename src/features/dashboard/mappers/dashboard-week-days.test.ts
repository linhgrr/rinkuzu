// Pinned before the tests read a Date. CI runs in UTC, where local getters and
// UTC getters return the same numbers, so a reader built on the wrong one looks
// correct there. These assertions only discriminate east of Greenwich, so the
// file fixes the offset the product actually ships to rather than inheriting the
// runner's. Node re-reads this on assignment.
process.env.TZ = 'Asia/Ho_Chi_Minh';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DashboardStatsDto } from '@/dtos/dashboard';
import { toUtcDateKey } from '@/lib/date-serialization';

import { buildWeekDays } from './dashboard-week-days';

const LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function activity(...keys: string[]): DashboardStatsDto['weeklyActivity'] {
  return Object.fromEntries(
    keys.map((key) => [
      key,
      { questionsReviewed: 3, xpEarned: 10, correctCount: 2, totalCount: 3 },
    ]),
  );
}

function activeLabels(days: ReturnType<typeof buildWeekDays>): string[] {
  return days.filter((day) => day.active).map((day) => day.label);
}

function at(iso: string): string {
  const now = new Date(iso);
  vi.setSystemTime(now);
  return toUtcDateKey(now, 'weeklyActivity.date');
}

afterEach(() => {
  vi.useRealTimers();
});

/**
 * QuizAttemptProgressRepository writes weeklyActivity keys with setUTCDate and
 * toUtcDateKey. These tests pin the reader to that same calendar.
 *
 * The instants matter. Most of the week a UTC+7 clock and a UTC clock agree on
 * the date, and a reader built on local getters passes anyway. The cases that
 * separate them are the hours between UTC evening and local midnight, when the
 * local week and the UTC week start on different days.
 */
describe('buildWeekDays', () => {
  it('lights the slot whose UTC key the repository would have written', () => {
    vi.useFakeTimers();
    at('2026-08-26T12:00:00.000Z'); // Wednesday, both calendars agree

    expect(activeLabels(buildWeekDays(activity('2026-08-26'), LABELS))).toEqual(['Wed']);
  });

  it('keeps an attempt visible when the local week has already rolled over', () => {
    vi.useFakeTimers();
    // 19:00 UTC Saturday is 02:00 Sunday in Asia/Ho_Chi_Minh. The repository
    // stores this attempt under Saturday. A reader on local getters builds the
    // week that starts at the local Sunday -- the day that has just begun --
    // and Saturday falls outside it, so the session the user just finished
    // disappears from the chart entirely rather than landing in the wrong slot.
    const stored = at('2026-08-22T19:00:00.000Z');
    expect(stored).toBe('2026-08-22');

    expect(activeLabels(buildWeekDays(activity(stored), LABELS))).toEqual(['Sat']);
  });

  it('keeps the last day of the UTC week in the window it was written to', () => {
    vi.useFakeTimers();
    // 17:30 UTC Saturday is 00:30 Sunday local: same rollover, later in the day.
    const stored = at('2026-08-29T17:30:00.000Z');
    expect(stored).toBe('2026-08-29');

    expect(activeLabels(buildWeekDays(activity(stored), LABELS))).toEqual(['Sat']);
  });

  it('spans the Sunday-to-Saturday UTC week containing today', () => {
    vi.useFakeTimers();
    at('2026-08-26T12:00:00.000Z');
    const week = [
      '2026-08-23',
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
    ];

    expect(activeLabels(buildWeekDays(activity(...week), LABELS))).toEqual(LABELS);
  });

  it('leaves days on either side of the window dark', () => {
    vi.useFakeTimers();
    at('2026-08-26T12:00:00.000Z');

    expect(activeLabels(buildWeekDays(activity('2026-08-22'), LABELS))).toEqual([]);
    expect(activeLabels(buildWeekDays(activity('2026-08-30'), LABELS))).toEqual([]);
  });

  it('treats a day with no questions reviewed as idle', () => {
    vi.useFakeTimers();
    at('2026-08-26T12:00:00.000Z');
    const idle = {
      '2026-08-26': { questionsReviewed: 0, xpEarned: 0, correctCount: 0, totalCount: 0 },
    };

    expect(activeLabels(buildWeekDays(idle, LABELS))).toEqual([]);
  });

  it('returns one slot per label', () => {
    vi.useFakeTimers();
    at('2026-08-26T12:00:00.000Z');

    expect(buildWeekDays({}, LABELS).map((day) => day.label)).toEqual(LABELS);
  });
});
