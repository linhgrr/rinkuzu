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
        isPrivate: false,
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
      isPrivate: false,
    });
  });

  it.each([
    { questions: [], isPrivate: false },
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
        isPrivate: false,
      }),
    ).toThrow('correctIndex out of range');
  });
});
