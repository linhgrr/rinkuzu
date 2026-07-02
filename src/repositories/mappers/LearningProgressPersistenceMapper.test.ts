import { describe, expect, it } from 'vitest';
import { LearningProgressPersistenceMapper } from '@/repositories/mappers/LearningProgressPersistenceMapper';
import type { QuestionProgressPersistenceRecord } from '@/repositories/types/LearningProgressPersistence';

function questionProgress(
  overrides: Partial<QuestionProgressPersistenceRecord> = {},
): QuestionProgressPersistenceRecord {
  const now = new Date('2026-07-02T00:00:00Z');
  return {
    _id: '507f191e810c19729de860ea',
    userId: '507f191e810c19729de860eb',
    quizSlug: 'algebra',
    questionId: 'question-1',
    questionRef: {
      text: '2 + 2 = ?',
      options: ['3', '4'],
      correctIndexes: [1],
    },
    srsLevel: 1,
    nextReviewDate: now,
    lastReviewDate: now,
    interval: 1,
    easeFactor: 2.5,
    correctStreak: 1,
    totalReviews: 1,
    totalCorrect: 1,
    history: [],
    isBookmarked: false,
    notes: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('LearningProgressPersistenceMapper', () => {
  it('preserves a valid persisted ease factor', () => {
    expect(
      LearningProgressPersistenceMapper.toQuestionProgress(questionProgress({ easeFactor: 2.1 }))
        .easeFactor,
    ).toBe(2.1);
  });

  it('rejects invalid persistence data instead of applying a service fallback', () => {
    expect(() =>
      LearningProgressPersistenceMapper.toQuestionProgress(
        questionProgress({ easeFactor: Number.NaN }),
      ),
    ).toThrow('questionProgress.easeFactor must be a positive finite number');
  });
});
