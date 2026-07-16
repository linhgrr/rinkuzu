import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WEEKLY_ACTIVITY_RETENTION_DAYS } from '@/lib/learning-progress-retention.mjs';

const modelMocks = vi.hoisted(() => ({
  questionBulkWrite: vi.fn(),
  userFindOne: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/models/QuestionProgress', () => ({
  default: { bulkWrite: modelMocks.questionBulkWrite },
}));
vi.mock('@/models/UserProgress', () => ({
  default: { findOne: modelMocks.userFindOne },
}));

import { QuizAttemptProgressRepository } from '@/repositories/QuizAttemptProgressRepository';

describe('QuizAttemptProgressRepository', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T00:30:00.000Z'));
    vi.clearAllMocks();
  });

  it('bounds weekly activity after recording a submitted attempt', async () => {
    const weeklyActivity = new Map(
      Array.from({ length: WEEKLY_ACTIVITY_RETENTION_DAYS + 3 }, (_, index) => {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() - index);
        return [
          date.toISOString().slice(0, 10),
          { questionsReviewed: 1, xpEarned: 10, correctCount: 1, totalCount: 1 },
        ] as const;
      }),
    );
    const userProgress = {
      totalXp: 100,
      totalQuizzesTaken: 2,
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: new Date(),
      streakFreezeCount: 0,
      weeklyActivity,
      averageAccuracy: 100,
      save: vi.fn().mockResolvedValue(undefined),
    };
    modelMocks.userFindOne.mockResolvedValue(userProgress);

    await new QuizAttemptProgressRepository().recordSubmittedAttempt({
      userId: 'user-1',
      quizSlug: 'architecture',
      totalQuestions: 10,
      correctAnswers: 8,
      wrongQuestions: [],
    });

    expect(userProgress.save).toHaveBeenCalledOnce();
    expect([...userProgress.weeklyActivity.keys()]).toHaveLength(WEEKLY_ACTIVITY_RETENTION_DAYS);
    expect(userProgress.weeklyActivity.has('2026-07-03')).toBe(true);
    expect(userProgress.weeklyActivity.has('2026-07-02')).toBe(false);
  });
});
