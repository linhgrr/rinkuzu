import { describe, expect, it } from 'vitest';
import { DashboardPersistenceMapper } from '@/repositories/mappers/DashboardPersistenceMapper';

describe('DashboardPersistenceMapper', () => {
  it('maps user progress records from persistence shape', () => {
    expect(
      DashboardPersistenceMapper.toUserProgress({
        currentStreak: 2,
        longestStreak: 5,
        streakFreezeCount: 1,
        totalXp: 120,
        weeklyActivity: new Map([
          [
            '2026-07-01',
            {
              questionsReviewed: 4,
              xpEarned: 20,
              correctCount: 3,
              totalCount: 4,
            },
          ],
        ]),
        totalQuestionsLearned: 40,
        totalReviewSessions: 9,
        averageAccuracy: 75,
      }),
    ).toEqual({
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
    });
  });

  it('maps populated in-progress quiz records and skips missing quiz records', () => {
    const updatedAt = new Date('2026-07-01T00:00:00Z');

    expect(
      DashboardPersistenceMapper.toInProgressQuiz({
        quiz: {
          _id: '507f191e810c19729de860ea',
          title: 'Quiz',
          slug: 'quiz',
        },
        answeredCount: 2,
        totalQuestions: 4,
        updatedAt,
      }),
    ).toEqual({
      quizId: '507f191e810c19729de860ea',
      title: 'Quiz',
      slug: 'quiz',
      answeredCount: 2,
      totalQuestions: 4,
      updatedAt,
    });

    expect(
      DashboardPersistenceMapper.toInProgressQuiz({
        quiz: null,
        answeredCount: 2,
        totalQuestions: 4,
        updatedAt,
      }),
    ).toBeNull();
  });
});
