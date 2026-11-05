import { describe, expect, it } from 'vitest';
import type { AttemptDetailDto } from '@/dtos/user';
import { toAttemptDetailViewModel } from '@/features/profile/mappers/attempt-detail.mapper';

describe('toAttemptDetailViewModel', () => {
  it('preserves discriminated answers and omits absent optional fields', () => {
    const result = toAttemptDetailViewModel(
      {
        id: 'attempt-1',
        score: 100,
        totalQuestions: 2,
        takenAt: '2026-07-02T00:00:00.000Z',
        answers: [1, [0, 1]],
        historyStatus: 'complete',
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
        missedCount: 0,
        nextQuiz: null,
      },
      'vi-VN',
    );

    expect(result.quiz).not.toHaveProperty('description');
    expect(result.quiz.questions[0]).not.toHaveProperty('correctIndexes');
    expect(result.quiz.questions[0]).not.toHaveProperty('questionImage');
    expect(result.quiz.questions[1]).not.toHaveProperty('correctIndex');
    expect(result).toMatchObject({ totalQuestions: 2, historyStatus: 'complete' });
    expect(result).not.toHaveProperty('questionIndices');
  });

  it('carries the retry mapping, missed count and next quiz to the result page', () => {
    const dto: AttemptDetailDto = {
      id: 'attempt-2',
      score: 0,
      totalQuestions: 1,
      takenAt: '2026-07-02T00:00:00.000Z',
      answers: [0],
      historyStatus: 'complete',
      quiz: {
        title: 'Algebra',
        slug: 'algebra',
        questions: [
          {
            id: 'q3',
            question: '3 + 3?',
            options: ['5', '6'],
            type: 'single',
            correctIndex: 1,
            userAnswer: 0,
            isCorrect: false,
          },
        ],
      },
      missedCount: 1,
      nextQuiz: { slug: 'starter', title: 'Starter' },
      retryOfAttemptId: 'attempt-1',
      questionIndices: [2],
    };
    const { retryOfAttemptId: _retry, ...plain } = dto;
    const result = toAttemptDetailViewModel(dto, 'en');
    const quick = toAttemptDetailViewModel(
      { ...plain, mode: 'quick', questionIndices: [17] },
      'en',
    );

    expect(result).toMatchObject({
      missedCount: 1,
      nextQuiz: { slug: 'starter', title: 'Starter' },
      retryOfAttemptId: 'attempt-1',
      questionIndices: [2],
    });
    expect(result).not.toHaveProperty('mode');
    expect(quick).toMatchObject({ mode: 'quick', questionIndices: [17] });
  });
});
