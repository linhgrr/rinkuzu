import { describe, expect, it } from 'vitest';
import {
  MAX_OPTION_COUNT,
  MAX_OPTION_TEXT_LENGTH,
  MAX_QUESTION_IMAGE_URL_LENGTH,
  MAX_QUESTION_TEXT_LENGTH,
  MAX_QUESTIONS_PER_QUIZ,
  MIN_OPTION_COUNT,
  questionListSchema,
} from '@/lib/validation/question';

function singleQuestion(overrides: Record<string, unknown> = {}) {
  return {
    question: 'Choose one',
    options: ['A', 'B'],
    type: 'single' as const,
    correctIndex: 0,
    ...overrides,
  };
}

describe('questionListSchema option content', () => {
  it('accepts image-only options', () => {
    expect(
      questionListSchema.safeParse([
        {
          question: 'Choose an image',
          options: ['', ''],
          optionImages: ['https://example.com/a.png', 'https://example.com/b.png'],
          type: 'single',
          correctIndex: 0,
        },
      ]).success,
    ).toBe(true);
  });

  it('rejects contentless options and misaligned option images', () => {
    const contentless = questionListSchema.safeParse([
      {
        question: 'Question',
        options: ['', 'B'],
        type: 'single',
        correctIndex: 0,
      },
    ]);
    const misalignedImages = questionListSchema.safeParse([
      {
        question: 'Question',
        options: ['A', 'B'],
        optionImages: ['https://example.com/a.png'],
        type: 'single',
        correctIndex: 0,
      },
    ]);

    expect(contentless.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: 'Option requires text or an image' }),
      ]),
    );
    expect(misalignedImages.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Option images array length must match options array length',
        }),
      ]),
    );
  });
});

describe('questionListSchema input-size ceilings', () => {
  it('accepts existing valid create/update-style payloads at field boundaries', () => {
    const atBoundaries = questionListSchema.safeParse([
      singleQuestion({
        question: 'x'.repeat(MAX_QUESTION_TEXT_LENGTH),
        options: [
          'y'.repeat(MAX_OPTION_TEXT_LENGTH),
          'z'.repeat(MAX_OPTION_TEXT_LENGTH),
          ...Array.from({ length: MAX_OPTION_COUNT - 2 }, (_, index) => `opt-${index}`),
        ],
        questionImage: 'u'.repeat(MAX_QUESTION_IMAGE_URL_LENGTH),
        optionImages: Array.from({ length: MAX_OPTION_COUNT }, () =>
          'i'.repeat(MAX_QUESTION_IMAGE_URL_LENGTH),
        ),
        correctIndex: 0,
      }),
    ]);

    expect(atBoundaries.success).toBe(true);
    expect(atBoundaries.data?.[0]?.options).toHaveLength(MAX_OPTION_COUNT);
  });

  it('accepts max question count and rejects one over', () => {
    const atMax = Array.from({ length: MAX_QUESTIONS_PER_QUIZ }, (_, index) =>
      singleQuestion({ question: `Q${index}` }),
    );
    const overMax = [...atMax, singleQuestion({ question: 'overflow' })];

    expect(questionListSchema.safeParse(atMax).success).toBe(true);
    expect(questionListSchema.safeParse(overMax).error?.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: 'Too many questions' })]),
    );
  });

  it('rejects oversized question text, option text, and image URLs', () => {
    const longQuestion = questionListSchema.safeParse([
      singleQuestion({ question: 'q'.repeat(MAX_QUESTION_TEXT_LENGTH + 1) }),
    ]);
    const longOption = questionListSchema.safeParse([
      singleQuestion({
        options: ['o'.repeat(MAX_OPTION_TEXT_LENGTH + 1), 'B'],
      }),
    ]);
    const longQuestionImage = questionListSchema.safeParse([
      singleQuestion({
        questionImage: 'u'.repeat(MAX_QUESTION_IMAGE_URL_LENGTH + 1),
      }),
    ]);
    const longOptionImage = questionListSchema.safeParse([
      singleQuestion({
        optionImages: ['u'.repeat(MAX_QUESTION_IMAGE_URL_LENGTH + 1), 'https://example.com/b.png'],
      }),
    ]);

    expect(longQuestion.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: `Question text must be at most ${MAX_QUESTION_TEXT_LENGTH} characters`,
        }),
      ]),
    );
    expect(longOption.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: `Option text must be at most ${MAX_OPTION_TEXT_LENGTH} characters`,
        }),
      ]),
    );
    expect(longQuestionImage.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: `Image URL must be at most ${MAX_QUESTION_IMAGE_URL_LENGTH} characters`,
        }),
      ]),
    );
    expect(longOptionImage.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: `Image URL must be at most ${MAX_QUESTION_IMAGE_URL_LENGTH} characters`,
        }),
      ]),
    );
  });

  it('keeps existing option count messages and min question list rule', () => {
    expect(questionListSchema.safeParse([]).error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: 'At least one question is required' }),
      ]),
    );

    const tooFewOptions = questionListSchema.safeParse([
      singleQuestion({ options: Array.from({ length: MIN_OPTION_COUNT - 1 }, () => 'A') }),
    ]);
    const tooManyOptions = questionListSchema.safeParse([
      singleQuestion({
        options: Array.from({ length: MAX_OPTION_COUNT + 1 }, (_, index) => `opt-${index}`),
        correctIndex: 0,
      }),
    ]);

    expect(tooFewOptions.error?.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: 'Need at least 2 options' })]),
    );
    expect(tooManyOptions.error?.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: 'Too many options' })]),
    );
  });
});
