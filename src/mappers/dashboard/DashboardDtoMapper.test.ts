import { describe, expect, it } from 'vitest';
import { DashboardDtoMapper } from '@/mappers/dashboard/DashboardDtoMapper';

const now = new Date('2026-07-01T00:00:00Z');

describe('DashboardDtoMapper', () => {
  it('maps empty progress to explicit zero defaults', () => {
    expect(DashboardDtoMapper.toStats(null, 3)).toEqual({
      streak: 0,
      longestStreak: 0,
      streakFreezeCount: 0,
      xp: 0,
      level: 1,
      xpToNextLevel: expect.any(Number),
      levelProgress: 0,
      dueCount: 3,
      weeklyActivity: {},
      totalQuestionsLearned: 0,
      totalReviewSessions: 0,
      averageAccuracy: 0,
    });
  });

  it('serializes in-progress dates', () => {
    expect(
      DashboardDtoMapper.toInProgressQuiz({
        quizId: 'quiz-1',
        title: 'Quiz',
        slug: 'quiz',
        answeredCount: 1,
        totalQuestions: 2,
        updatedAt: now,
      }),
    ).toEqual({
      quizId: 'quiz-1',
      title: 'Quiz',
      slug: 'quiz',
      answeredCount: 1,
      totalQuestions: 2,
      updatedAt: now.toISOString(),
    });
  });
});
