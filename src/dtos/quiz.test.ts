import { describe, expect, it } from 'vitest';
import {
  addDiscussionCommentRequestSchema,
  createQuizRequestSchema,
  reportQuizRequestSchema,
  savedQuizProgressSchema,
  submitQuizAttemptRequestSchema,
  updateQuizRequestSchema,
} from '@/dtos/quiz';

describe('quiz DTO schemas', () => {
  it('trims and validates report quiz requests', () => {
    expect(reportQuizRequestSchema.parse({ content: '  wrong answer  ' })).toEqual({
      content: 'wrong answer',
    });
  });

  it('rejects invalid report quiz requests', () => {
    expect(() => reportQuizRequestSchema.parse({ content: '' })).toThrow();
    expect(() => reportQuizRequestSchema.parse({ content: 'x'.repeat(2001) })).toThrow();
    expect(() => reportQuizRequestSchema.parse({ content: 'valid', extra: true })).toThrow();
  });

  it('validates saved quiz progress payloads', () => {
    expect(
      savedQuizProgressSchema.parse({
        questionOrder: [1, 0],
        optionOrders: [
          [0, 1],
          [1, 0],
        ],
        userAnswers: [0, [0, 1]],
        currentQuestionIndex: 1,
        answeredCount: 2,
        totalQuestions: 2,
      }),
    ).toEqual({
      questionOrder: [1, 0],
      optionOrders: [
        [0, 1],
        [1, 0],
      ],
      userAnswers: [0, [0, 1]],
      currentQuestionIndex: 1,
      answeredCount: 2,
      totalQuestions: 2,
    });
  });

  it('rejects inconsistent saved quiz progress lengths', () => {
    expect(() =>
      savedQuizProgressSchema.parse({
        questionOrder: [1],
        optionOrders: [[0, 1]],
        userAnswers: [0, 1],
        currentQuestionIndex: 0,
        answeredCount: 1,
        totalQuestions: 1,
      }),
    ).toThrow('Progress payload length mismatch');
  });

  it('validates quiz attempt request payloads', () => {
    expect(
      submitQuizAttemptRequestSchema.parse({
        answers: [0, [1, 2], -1],
        idempotencyKey: '018f7494-8bd8-7b8a-a387-3bc5a14f22a1',
        userEmail: ' Learner@Example.com ',
      }),
    ).toEqual({
      answers: [0, [1, 2], -1],
      idempotencyKey: '018f7494-8bd8-7b8a-a387-3bc5a14f22a1',
      userEmail: 'learner@example.com',
    });
  });

  it('rejects attempts without an idempotency key or with fractional answer indexes', () => {
    expect(() =>
      submitQuizAttemptRequestSchema.parse({
        answers: [0],
        userEmail: 'learner@example.com',
      }),
    ).toThrow();
    expect(() =>
      submitQuizAttemptRequestSchema.parse({
        answers: [[0.5]],
        idempotencyKey: '018f7494-8bd8-7b8a-a387-3bc5a14f22a1',
        userEmail: 'learner@example.com',
      }),
    ).toThrow();
  });

  it('validates add discussion comment request payloads', () => {
    expect(
      addDiscussionCommentRequestSchema.parse({
        questionIndex: 1,
        content: '  Please explain this step.  ',
      }),
    ).toEqual({
      questionIndex: 1,
      content: 'Please explain this step.',
    });
  });

  it('validates create quiz request payloads with normalized question text', () => {
    expect(
      createQuizRequestSchema.parse({
        title: '  Algebra basics  ',
        description: '  Intro  ',
        folderId: null,
        questions: [
          {
            question: '  2 + 2?  ',
            options: ['  3 ', ' 4 '],
            type: 'single',
            correctIndex: 1,
          },
        ],
        isPrivate: false,
      }),
    ).toEqual({
      title: 'Algebra basics',
      description: 'Intro',
      folderId: null,
      questions: [
        {
          question: '2 + 2?',
          options: ['3', '4'],
          type: 'single',
          correctIndex: 1,
        },
      ],
      isPrivate: false,
    });
  });

  it('validates update quiz request payloads and rejects empty updates', () => {
    expect(updateQuizRequestSchema.parse({ folder: null })).toEqual({ folder: null });
    expect(() => updateQuizRequestSchema.parse({})).toThrow('No quiz fields provided');
  });
});
