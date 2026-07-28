import { describe, expect, it } from 'vitest';
import { AdminStatsDtoMapper } from '@/mappers/admin/AdminStatsDtoMapper';

describe('AdminStatsDtoMapper analytics', () => {
  it('fills missing dates and compares equal-length periods', () => {
    const result = AdminStatsDtoMapper.toGrowthTrendsDto(
      {
        users: [
          { date: '2026-07-27', count: 2 },
          { date: '2026-07-28', count: 4 },
        ],
        quizzes: [{ date: '2026-07-28', count: 3 }],
        attempts: [
          {
            date: '2026-07-21',
            count: 2,
            scoreTotal: 100,
            scoredAttempts: 2,
          },
          {
            date: '2026-07-28',
            count: 4,
            scoreTotal: 320,
            scoredAttempts: 4,
          },
        ],
      },
      7,
      new Date('2026-07-28T20:00:00.000Z'),
    );

    expect(result.data).toHaveLength(7);
    expect(result).toMatchObject({
      period: 7,
      from: '2026-07-22',
      to: '2026-07-28',
      comparison: {
        newUsers: { current: 6, previous: 0, changePercent: null },
        newQuizzes: { current: 3, previous: 0, changePercent: null },
        attempts: { current: 4, previous: 2, changePercent: 100 },
        averageScore: { current: 80, previous: 50, changePercent: 60 },
      },
    });
    expect(result.data[0]).toEqual({
      date: '2026-07-22',
      newUsers: 0,
      newQuizzes: 0,
      attempts: 0,
      averageScore: null,
    });
    expect(result.data.at(-1)?.averageScore).toBe(80);
  });

  it('calculates pass rate from semantic passing buckets', () => {
    expect(
      AdminStatsDtoMapper.toScoreStatsDto(
        { averageScore: 69.6, highestScore: 100, lowestScore: 0 },
        [
          { range: '60–69%', min: 60, max: 70, count: 3, passing: false },
          { range: '70–79%', min: 70, max: 80, count: 7, passing: true },
        ],
      ),
    ).toEqual({
      averageScore: 70,
      highestScore: 100,
      lowestScore: 0,
      passRate: 70,
      scoreDistribution: [
        { range: '60–69%', min: 60, max: 70, count: 3, passing: false },
        { range: '70–79%', min: 70, max: 80, count: 7, passing: true },
      ],
    });
  });
});
