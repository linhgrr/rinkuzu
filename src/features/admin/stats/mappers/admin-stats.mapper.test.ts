import { describe, expect, it } from 'vitest';
import { toAdminStatsViewModel } from '@/features/admin/stats/mappers/admin-stats.mapper';

describe('toAdminStatsViewModel', () => {
  it('maps admin stats without deleted or anonymous activity fallbacks', () => {
    expect(
      toAdminStatsViewModel({
        totalQuizzes: 1,
        totalUsers: 2,
        totalAdmins: 1,
        totalAttempts: 3,
        overview: {
          totalQuizzes: 1,
          totalUsers: 2,
          totalAdmins: 1,
          totalAttempts: 3,
        },
        timeBasedStats: {
          today: { newUsers: 1, newQuizzes: 1, attempts: 1 },
          thisWeek: { newUsers: 2, newQuizzes: 2, attempts: 2 },
          thisMonth: { newUsers: 3, newQuizzes: 3, attempts: 3 },
        },
        recentActivity: {
          users: [{ email: 'learner@example.com', createdAt: '2026-07-02T00:00:00.000Z' }],
          quizzes: [
            {
              title: 'Algebra',
              createdAt: '2026-07-02T00:00:00.000Z',
              author: { id: 'user-1', email: 'learner@example.com' },
              questionCount: 10,
            },
          ],
          attempts: [
            {
              id: 'attempt-1',
              score: 80,
              takenAt: '2026-07-02T00:00:00.000Z',
              answeredQuestions: 8,
              actor: { email: 'learner@example.com', type: 'user' },
              quiz: { title: 'Algebra' },
            },
          ],
        },
        topCreators: [
          {
            id: 'user-1',
            email: 'learner@example.com',
            quizCount: 1,
            totalQuestions: 10,
            joinedAt: '2026-07-01T00:00:00.000Z',
            role: 'user',
            successRate: 80,
          },
        ],
        scoreStats: {
          averageScore: 80,
          highestScore: 100,
          lowestScore: 60,
        },
        growthTrends: {
          users: [],
          quizzes: [],
          attempts: [],
        },
      }),
    ).toEqual({
      overview: {
        totalQuizzes: 1,
        totalUsers: 2,
        totalAdmins: 1,
        totalAttempts: 3,
      },
      timeBasedStats: {
        today: { newUsers: 1, newQuizzes: 1, attempts: 1 },
        thisWeek: { newUsers: 2, newQuizzes: 2, attempts: 2 },
        thisMonth: { newUsers: 3, newQuizzes: 3, attempts: 3 },
      },
      recentActivity: {
        users: [
          {
            email: 'learner@example.com',
            createdAt: '2026-07-02T00:00:00.000Z',
            createdAtLabel: '07:00 02/07/2026',
          },
        ],
        quizzes: [
          {
            title: 'Algebra',
            createdAt: '2026-07-02T00:00:00.000Z',
            createdAtLabel: '07:00 02/07/2026',
            questionCount: 10,
          },
        ],
        attempts: [
          {
            id: 'attempt-1',
            score: 80,
            takenAt: '2026-07-02T00:00:00.000Z',
            takenAtLabel: '07:00 02/07/2026',
            answeredQuestions: 8,
            actor: { email: 'learner@example.com', type: 'user' },
            quiz: { title: 'Algebra' },
          },
        ],
      },
      topCreators: [
        {
          id: 'user-1',
          email: 'learner@example.com',
          quizCount: 1,
          totalQuestions: 10,
          joinedAt: '2026-07-01T00:00:00.000Z',
          role: 'user',
          successRate: 80,
        },
      ],
      scoreStats: {
        averageScore: 80,
        highestScore: 100,
        lowestScore: 60,
      },
    });
  });
});
