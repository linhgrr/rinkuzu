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
    const questionId = '507f1f77bcf86cd799439011';
    expect(reportQuizRequestSchema.parse({ questionId, content: '  wrong answer  ' })).toEqual({
      questionId,
      content: 'wrong answer',
    });
  });

  it('rejects invalid report quiz requests', () => {
    expect(() => reportQuizRequestSchema.parse({ content: '' })).toThrow();
    expect(() =>
      reportQuizRequestSchema.parse({ questionId: 'not-an-object-id', content: 'valid' }),
    ).toThrow();
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

  it('rejects corrupt saved quiz progress ordering and indexes', () => {
    const base = {
      optionOrders: [
        [0, 1],
        [1, 0],
      ],
      userAnswers: [0, [0, 1]],
      currentQuestionIndex: 0,
      answeredCount: 1,
      totalQuestions: 2,
    };

    expect(() =>
      savedQuizProgressSchema.parse({
        ...base,
        questionOrder: [0, 0],
      }),
    ).toThrow('Invalid question order');

    expect(() =>
      savedQuizProgressSchema.parse({
        ...base,
        questionOrder: [0, 2],
      }),
    ).toThrow('Invalid question order');

    expect(() =>
      savedQuizProgressSchema.parse({
        ...base,
        questionOrder: [0.5, 1],
      }),
    ).toThrow();

    expect(() =>
      savedQuizProgressSchema.parse({
        ...base,
        questionOrder: [1, 0],
        currentQuestionIndex: 2,
      }),
    ).toThrow('Invalid current question index');

    expect(() =>
      savedQuizProgressSchema.parse({
        ...base,
        questionOrder: [1, 0],
        optionOrders: [
          [0, 0],
          [1, 0],
        ],
      }),
    ).toThrow('Invalid option order');
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
