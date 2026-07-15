import { describe, expect, it } from 'vitest';
import { toAttemptDetailViewModel } from '@/features/profile/mappers/attempt-detail.mapper';

describe('toAttemptDetailViewModel', () => {
  it('preserves discriminated answers and omits absent optional fields', () => {
    const result = toAttemptDetailViewModel(
      {
        id: 'attempt-1',
        score: 100,
        takenAt: '2026-07-02T00:00:00.000Z',
        answers: [1, [0, 1]],
        quiz: {
          title: 'Algebra',
          slug: 'algebra',
          questions: [
            {
              id: 'q1',
              question: '2 + 2?',
              options: ['3', '4'],
              type: 'single',
              correctIndex: 1,
              userAnswer: 1,
              isCorrect: true,
            },
            {
              id: 'q2',
              question: 'Primes?',
              options: ['2', '3'],
              type: 'multiple',
              correctIndexes: [0, 1],
              userAnswer: [0, 1],
              isCorrect: true,
            },
          ],
        },
      },
      'vi-VN',
    );

    expect(result.quiz).not.toHaveProperty('description');
    expect(result.quiz.questions[0]).not.toHaveProperty('correctIndexes');
    expect(result.quiz.questions[0]).not.toHaveProperty('questionImage');
    expect(result.quiz.questions[1]).not.toHaveProperty('correctIndex');
  });
});
