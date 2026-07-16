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

  it('scores partial correctness and collects wrong question snapshots', () => {
    const result = evaluateQuizAttempt(questions, [0, [0, 2]]);

    expect(result).toMatchObject({
      answers: [0, [0, 2]],
      correctAnswers: 1,
      score: 50,
      totalQuestions: 2,
    });
    expect(result.wrongQuestions).toEqual([
      {
        questionId: 'single-1',
        question: questions[0],
      },
    ]);
  });

  it('treats incomplete multiple-choice sets as incorrect', () => {
    const result = evaluateQuizAttempt(questions, [1, [0]]);
    expect(result.correctAnswers).toBe(1);
    expect(result.wrongQuestions.map(({ questionId }) => questionId)).toEqual(['multiple-1']);
  });

  it.each([
    { answers: [[1], [0, 2]], reason: 'single-choice answers must be integers' },
    { answers: [2, [0, 2]], reason: 'single-choice answer is out of range' },
    { answers: [-2, [0, 2]], reason: 'single-choice answer is out of range' },
    { answers: [1, 0], reason: 'multiple-choice answers must be arrays' },
    { answers: [1, [0, 0]], reason: 'must not contain duplicates' },
    { answers: [1, [0, 3]], reason: 'multiple-choice answer is out of range' },
    { answers: [1, [0.5]], reason: 'must contain integers' },
    { answers: [1.5, [0, 2]], reason: 'single-choice answers must be integers' },
  ])('rejects malformed answers instead of coercing them: $reason', ({ answers, reason }) => {
    expect(() => evaluateQuizAttempt(questions, answers)).toThrow(reason);
    expect(() => evaluateQuizAttempt(questions, answers)).toThrow(InvalidQuizAttemptAnswersError);
  });

  it('accepts only the canonical unanswered representation for each question type', () => {
    const result = evaluateQuizAttempt(questions, [-1, []]);

    expect(result).toMatchObject({ answers: [-1, []], correctAnswers: 0, score: 0 });
    expect(result.wrongQuestions.map(({ questionId }) => questionId)).toEqual([
      'single-1',
      'multiple-1',
    ]);
  });

  it('rejects answer-count mismatches and empty quizzes', () => {
    expect(() => evaluateQuizAttempt(questions, [1])).toThrow(InvalidQuizAttemptAnswersError);
    expect(() => evaluateQuizAttempt(questions, [1])).toThrow(
      'Answer count must match question count',
    );
    expect(() => evaluateQuizAttempt([], [])).toThrow(TypeError);
    expect(() => evaluateQuizAttempt([], [])).toThrow('Cannot evaluate a quiz without questions');
  });

  it('fails closed when question keys are missing correct answers', () => {
    const brokenSingle: QuizQuestion[] = [
      {
        id: 'broken-single',
        question: '?',
        options: ['A', 'B'],
        type: 'single',
        correctIndex: Number.NaN,
      },
    ];
    const brokenMultiple: QuizQuestion[] = [
      {
        id: 'broken-multiple',
        question: '?',
        options: ['A', 'B'],
        type: 'multiple',
        correctIndexes: [],
      },
    ];

    expect(() => evaluateQuizAttempt(brokenSingle, [0])).toThrow(
      'Quiz question broken-single has no valid correctIndex',
    );
    expect(() => evaluateQuizAttempt(brokenMultiple, [[0]])).toThrow(
      'Quiz question broken-multiple has no valid correctIndexes',
    );
  });

  it('names InvalidQuizAttemptAnswersError consistently', () => {
    const error = new InvalidQuizAttemptAnswersError('bad');
    expect(error.name).toBe('InvalidQuizAttemptAnswersError');
    expect(error.message).toBe('bad');
  });
});
