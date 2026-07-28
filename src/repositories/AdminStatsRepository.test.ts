import { beforeEach, describe, expect, it, vi } from 'vitest';

const modelMocks = vi.hoisted(() => ({
  userAggregate: vi.fn(),
  quizAggregate: vi.fn(),
  attemptAggregate: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/models/User', () => ({ default: { aggregate: modelMocks.userAggregate } }));
vi.mock('@/models/Quiz', () => ({ default: { aggregate: modelMocks.quizAggregate } }));
vi.mock('@/models/Attempt', () => ({ default: { aggregate: modelMocks.attemptAggregate } }));

import { AdminStatsRepository } from '@/repositories/AdminStatsRepository';

describe('AdminStatsRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aggregates daily activity in UTC and preserves score totals', async () => {
    modelMocks.userAggregate.mockResolvedValue([{ _id: '2026-07-28', count: 2 }]);
    modelMocks.quizAggregate.mockResolvedValue([{ _id: '2026-07-28', count: 1 }]);
    modelMocks.attemptAggregate.mockResolvedValue([
      {
        _id: '2026-07-28',
        count: 3,
        scoreTotal: 240,
        scoredAttempts: 3,
      },
    ]);
    const since = new Date('2026-07-01T00:00:00.000Z');

    await expect(new AdminStatsRepository().getDailyActivity(since)).resolves.toEqual({
      users: [{ date: '2026-07-28', count: 2 }],
      quizzes: [{ date: '2026-07-28', count: 1 }],
      attempts: [
        {
          date: '2026-07-28',
          count: 3,
          scoreTotal: 240,
          scoredAttempts: 3,
        },
      ],
    });

    expect(modelMocks.userAggregate).toHaveBeenCalledWith([
      { $match: { createdAt: { $gte: since } } },
      expect.objectContaining({
        $group: expect.objectContaining({
          _id: { $dateToString: expect.objectContaining({ timezone: 'UTC' }) },
        }),
      }),
      { $sort: { _id: 1 } },
    ]);
    expect(modelMocks.attemptAggregate).toHaveBeenCalledWith([
      { $match: { takenAt: { $gte: since } } },
      expect.objectContaining({
        $group: expect.objectContaining({
          scoreTotal: { $sum: '$score' },
          scoredAttempts: { $sum: 1 },
        }),
      }),
      { $sort: { _id: 1 } },
    ]);
  });

  it('uses non-overlapping score buckets with the passing boundary at 70%', async () => {
    modelMocks.attemptAggregate.mockResolvedValue([
      { _id: 0, count: 1 },
      { _id: 60, count: 2 },
      { _id: 70, count: 3 },
      { _id: 90, count: 4 },
    ]);

    const result = await new AdminStatsRepository().getScoreDistribution();

    expect(result).toHaveLength(10);
    expect(result.find((bucket) => bucket.min === 60)).toMatchObject({
      range: '60–69%',
      count: 2,
      passing: false,
    });
    expect(result.find((bucket) => bucket.min === 70)).toMatchObject({
      range: '70–79%',
      count: 3,
      passing: true,
    });
    const [pipeline] = modelMocks.attemptAggregate.mock.calls[0] ?? [];
    expect(pipeline[0].$bucket.boundaries).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 101]);
  });
});
