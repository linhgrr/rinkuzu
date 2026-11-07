import { describe, expect, it, vi } from 'vitest';

import { adminReviewEmailStatsSchema } from '@/dtos/admin-stats';
import type { ReviewEmailWeeklyCounts } from '@/interfaces/repositories/IReviewEmailStatsRepository';
import { ReviewEmailStatsService } from '@/services/admin/ReviewEmailStatsService';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Thursday of 2026-W45; the window is W44 (Oct 26) and W45 (Nov 2).
const NOW = new Date('2026-11-05T12:00:00.000Z');
const W44 = new Date('2026-10-26T00:00:00.000Z');
const W45 = new Date('2026-11-02T00:00:00.000Z');

function service(counts: ReviewEmailWeeklyCounts | Error, qaEmails = ['qa@fake.test']) {
  const getWeeklyCounts = vi.fn(async () => {
    if (counts instanceof Error) throw counts;
    return counts;
  });
  return {
    getWeeklyCounts,
    service: new ReviewEmailStatsService({
      stats: { getWeeklyCounts },
      qaEmails: () => qaEmails,
      now: () => NOW,
    }),
  };
}

describe('ReviewEmailStatsService', () => {
  it('fills every ISO week, oldest first, and passes the QA recipients to exclude', async () => {
    const { service: subject, getWeeklyCounts } = service({
      sends: [{ weekStart: W45, sent: 4, opened: 2 }],
      consents: [{ weekStart: W44, optIns: 3, unsubscribed: 1 }],
      opensTracked: true,
    });

    const result = await subject.getWeekly(2);

    expect(getWeeklyCounts).toHaveBeenCalledWith(W44, new Date('2026-11-09T00:00:00.000Z'), [
      'qa@fake.test',
    ]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(adminReviewEmailStatsSchema.parse(result.data)).toEqual(result.data);
    expect(result.data.opensTracked).toBe(true);
    expect(result.data.weeks).toEqual([
      {
        isoWeek: '2026-W44',
        start: '2026-10-26T00:00:00.000Z',
        end: '2026-11-01T23:59:59.999Z',
        sent: 0,
        opened: 0,
        unsubscribed: 1,
        optIns: 3,
      },
      {
        isoWeek: '2026-W45',
        start: '2026-11-02T00:00:00.000Z',
        end: '2026-11-08T23:59:59.999Z',
        sent: 4,
        opened: 2,
        unsubscribed: 0,
        optIns: 0,
      },
    ]);
  });

  it('reports opens as null when open tracking is off', async () => {
    const { service: subject } = service({
      sends: [{ weekStart: W45, sent: 4, opened: 0 }],
      consents: [],
      opensTracked: false,
    });

    const result = await subject.getWeekly(1);

    expect(result.success && result.data.opensTracked).toBe(false);
    expect(result.success && result.data.weeks[0]?.opened).toBeNull();
  });

  it('uses the system clock when no clock is injected', async () => {
    vi.useFakeTimers({ now: NOW });
    try {
      const subject = new ReviewEmailStatsService({
        stats: {
          getWeeklyCounts: async () => ({ sends: [], consents: [], opensTracked: true }),
        },
        qaEmails: () => [],
      });

      const result = await subject.getWeekly(1);

      expect(result.success && result.data.generatedAt).toBe(NOW.toISOString());
      expect(result.success && result.data.weeks[0]?.isoWeek).toBe('2026-W45');
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails without internals when the database read fails', async () => {
    const { service: subject } = service(new Error('mongo down'));

    await expect(subject.getWeekly(8)).resolves.toEqual({
      success: false,
      error: 'Failed to get review email statistics',
      statusCode: 500,
    });
  });
});
