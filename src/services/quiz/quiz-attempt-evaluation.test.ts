import { describe, expect, it } from 'vitest';
import type { QuizQuestion } from '@/entities/Quiz';
import {
  evaluateQuizAttempt,
  InvalidQuizAttemptAnswersError,
} from '@/services/quiz/quiz-attempt-evaluation';

const questions: QuizQuestion[] = [
  {
    id: 'single-1',
    question: 'Single?',
    options: ['A', 'B'],
    type: 'single',
    correctIndex: 1,
  },
  {
    id: 'multiple-1',
    question: 'Multiple?',
    options: ['A', 'B', 'C'],
    type: 'multiple',
    correctIndexes: [0, 2],
  },
];

describe('evaluateQuizAttempt', () => {
  it('normalizes multiple-choice ordering and evaluates once', () => {
    expect(evaluateQuizAttempt(questions, [1, [2, 0]])).toEqual({
      answers: [1, [0, 2]],
      correctAnswers: 2,
      score: 100,
      totalQuestions: 2,
      wrongQuestions: [],
    });
  });

  it.each([
    { answers: [[1], [0, 2]], reason: 'single-choice answers must be integers' },
    { answers: [2, [0, 2]], reason: 'single-choice answer is out of range' },
    { answers: [1, 0], reason: 'multiple-choice answers must be arrays' },
    { answers: [1, [0, 0]], reason: 'must not contain duplicates' },
    { answers: [1, [0, 3]], reason: 'multiple-choice answer is out of range' },
    { answers: [1, [0.5]], reason: 'must contain integers' },
  ])('rejects malformed answers instead of coercing them: $reason', ({ answers, reason }) => {
    expect(() => evaluateQuizAttempt(questions, answers)).toThrow(reason);
  });

  it('accepts only the canonical unanswered representation for each question type', () => {
    const result = evaluateQuizAttempt(questions, [-1, []]);

    expect(result).toMatchObject({ answers: [-1, []], correctAnswers: 0, score: 0 });
    expect(result.wrongQuestions.map(({ questionId }) => questionId)).toEqual([
      'single-1',
      'multiple-1',
    ]);
  });

  it('rejects answer-count mismatches', () => {
    expect(() => evaluateQuizAttempt(questions, [1])).toThrow(InvalidQuizAttemptAnswersError);
  });
});
