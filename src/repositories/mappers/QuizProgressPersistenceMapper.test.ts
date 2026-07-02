import { describe, expect, it } from 'vitest';
import { QuizProgressPersistenceMapper } from '@/repositories/mappers/QuizProgressPersistenceMapper';

describe('QuizProgressPersistenceMapper', () => {
  it('maps persistence selected answers back to saved progress answers', () => {
    const updatedAt = new Date('2026-07-01T10:00:00.000Z');

    expect(
      QuizProgressPersistenceMapper.toEntity({
        _id: 'progress-1',
        userId: 'user-1',
        quiz: {
          _id: 'quiz-1',
          title: 'Architecture',
          slug: 'architecture',
        },
        questionOrder: [1, 0],
        optionOrders: [
          [0, 1],
          [1, 0],
        ],
        userAnswers: [
          { kind: 'single', selectedIndex: null },
          { kind: 'multiple', selectedIndexes: [0, 1] },
        ],
        currentQuestionIndex: 1,
        answeredCount: 1,
        totalQuestions: 2,
        updatedAt,
      }),
    ).toEqual({
      id: 'progress-1',
      userId: 'user-1',
      quiz: {
        id: 'quiz-1',
        title: 'Architecture',
        slug: 'architecture',
      },
      questionOrder: [1, 0],
      optionOrders: [
        [0, 1],
        [1, 0],
      ],
      userAnswers: [-1, [0, 1]],
      currentQuestionIndex: 1,
      answeredCount: 1,
      totalQuestions: 2,
      updatedAt,
    });
  });
});
