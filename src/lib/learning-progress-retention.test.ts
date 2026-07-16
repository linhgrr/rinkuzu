import { describe, expect, it } from 'vitest';
import {
  QUESTION_REVIEW_HISTORY_LIMIT,
  WEEKLY_ACTIVITY_RETENTION_DAYS,
  retainRecentReviewHistory,
  retainRecentWeeklyActivity,
} from '@/lib/learning-progress-retention.mjs';

describe('learning progress retention', () => {
  it('keeps only the newest review history entries', () => {
    const history = Array.from({ length: QUESTION_REVIEW_HISTORY_LIMIT + 5 }, (_, index) => index);

    expect(retainRecentReviewHistory(history)).toEqual(
      history.slice(-QUESTION_REVIEW_HISTORY_LIMIT),
    );
    expect(history).toHaveLength(QUESTION_REVIEW_HISTORY_LIMIT + 5);
  });

  it('keeps only valid UTC activity dates inside the dashboard retention window', () => {
    const anchor = new Date('2026-07-16T00:30:00.000Z');
    const activity = new Map(
      Array.from({ length: WEEKLY_ACTIVITY_RETENTION_DAYS + 3 }, (_, index) => {
        const date = new Date(anchor);
        date.setUTCDate(date.getUTCDate() - index);
        return [date.toISOString().slice(0, 10), index] as const;
      }),
    );
    activity.set('invalid-date', 100);
    activity.set('2026-07-17', 101);

    const retained = retainRecentWeeklyActivity(activity, anchor);

    expect([...retained.keys()]).toHaveLength(WEEKLY_ACTIVITY_RETENTION_DAYS);
    expect(retained.has('2026-07-16')).toBe(true);
    expect(retained.has('2026-07-03')).toBe(true);
    expect(retained.has('2026-07-02')).toBe(false);
    expect(retained.has('invalid-date')).toBe(false);
    expect(retained.has('2026-07-17')).toBe(false);
  });

  it('rejects invalid retention arguments instead of silently dropping data', () => {
    expect(() => retainRecentReviewHistory([], 0)).toThrow(/positive safe integer/);
    expect(() => retainRecentWeeklyActivity([], new Date('invalid'))).toThrow(
      /anchor date must be valid/,
    );
  });
});
