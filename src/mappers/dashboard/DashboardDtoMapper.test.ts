import { describe, expect, it } from 'vitest';
import { DashboardDtoMapper } from '@/mappers/dashboard/DashboardDtoMapper';

const now = new Date('2026-07-01T00:00:00Z');

describe('DashboardDtoMapper', () => {
  it('maps progress records without field-level fallbacks', () => {
    expect(
      DashboardDtoMapper.toStats(
        {
          currentStreak: 2,
          longestStreak: 5,
          streakFreezeCount: 1,
          totalXp: 120,
          weeklyActivity: {
            '2026-07-01': {
              questionsReviewed: 4,
              xpEarned: 20,
              correctCount: 3,
              totalCount: 4,
            },
          },
          totalQuestionsLearned: 40,
          totalReviewSessions: 9,
          averageAccuracy: 75,
        },
        3,
      ),
    ).toEqual({
      streak: 2,
      longestStreak: 5,
      streakFreezeCount: 1,
      xp: 120,
      level: 2,
      xpToNextLevel: expect.any(Number),
      levelProgress: 20,
      dueCount: 3,
      weeklyActivity: {
        '2026-07-01': {
          questionsReviewed: 4,
          xpEarned: 20,
          correctCount: 3,
          totalCount: 4,
        },
      },
      totalQuestionsLearned: 40,
      totalReviewSessions: 9,
      averageAccuracy: 75,
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
