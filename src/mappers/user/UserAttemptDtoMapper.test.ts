import { describe, expect, it } from 'vitest';
import type { Attempt } from '@/entities/Attempt';
import { UserAttemptDtoMapper } from '@/mappers/user/UserAttemptDtoMapper';

const attempt: Attempt = {
  id: 'attempt-1',
  user: 'user-1',
  quiz: {
    id: 'quiz-1',
    title: 'Algebra',
    slug: 'algebra',
    questions: [
      {
        id: 'question-1',
        question: '2 + 2?',
        options: ['3', '4'],
        type: 'single',
        correctIndex: 1,
      },
      {
        id: 'question-2',
        question: 'Select primes',
        options: ['2', '3', '4'],
        type: 'multiple',
        correctIndexes: [0, 1],
      },
    ],
  },
  answers: [1, [1, 0]],
  score: 100,
  totalQuestions: 2,
  takenAt: new Date('2026-07-02T00:00:00Z'),
};

describe('UserAttemptDtoMapper', () => {
  it('maps populated attempts and evaluates answer correctness', () => {
    const dto = UserAttemptDtoMapper.toDetailDto(attempt);

    expect(dto.takenAt).toBe('2026-07-02T00:00:00.000Z');
    expect(dto.quiz.questions.map((question) => question.isCorrect)).toEqual([true, true]);
  });

  it('rejects attempts whose answers do not match the quiz snapshot', () => {
    expect(() => UserAttemptDtoMapper.toDetailDto({ ...attempt, answers: [1] })).toThrow(
      'attempt.answers must match quiz questions',
    );
  });
});
