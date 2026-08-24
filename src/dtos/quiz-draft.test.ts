import { describe, expect, it } from 'vitest';
import { submitQuizDraftRequestSchema } from '@/dtos/quiz-draft';

describe('quiz draft DTO schemas', () => {
  it('normalizes provided submit fields at the controller DTO boundary', () => {
    expect(
      submitQuizDraftRequestSchema.parse({
        title: '  Arithmetic  ',
        description: '  Basic addition  ',
        questions: [
          {
            question: '  What is 2 + 2?  ',
            options: ['  3  ', '  4  '],
            type: 'single',
            correctIndex: 1,
          },
        ],
        submitToPremium: false,
      }),
    ).toEqual({
      title: 'Arithmetic',
      description: 'Basic addition',
      questions: [
        {
          question: 'What is 2 + 2?',
          options: ['3', '4'],
          type: 'single',
          correctIndex: 1,
        },
      ],
      submitToPremium: false,
    });
  });

  it.each([
    { questions: [], submitToPremium: false },
    { title: 'Quiz', questions: [] },
  ])('rejects missing required submit fields instead of fabricating defaults', (input) => {
    expect(submitQuizDraftRequestSchema.safeParse(input).success).toBe(false);
  });

  it('rejects invalid submit draft questions before the service layer', () => {
    expect(() =>
      submitQuizDraftRequestSchema.parse({
        title: 'Invalid quiz',
        questions: [
          {
            question: 'Select one',
            options: ['A', 'B'],
            type: 'single',
            correctIndex: 3,
          },
        ],
        submitToPremium: false,
      }),
    ).toThrow('correctIndex out of range');
  });

  it('requires sharing-rights confirmation for Premium draft submissions', () => {
    const base = {
      title: 'Premium draft',
      questions: [
        {
          question: 'Pick one',
          options: ['A', 'B'],
          type: 'single' as const,
          correctIndex: 0,
        },
      ],
      submitToPremium: true,
    };
    expect(submitQuizDraftRequestSchema.safeParse(base).success).toBe(false);
    expect(submitQuizDraftRequestSchema.safeParse({ ...base, rightsAttested: true }).success).toBe(
      true,
    );
  });
});
