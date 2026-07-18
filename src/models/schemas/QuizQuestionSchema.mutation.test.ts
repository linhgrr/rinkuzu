import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import {
  MAX_OPTION_COUNT,
  MAX_OPTION_TEXT_LENGTH,
  MAX_QUESTION_IMAGE_URL_LENGTH,
  MAX_QUESTION_TEXT_LENGTH,
} from '@/lib/validation/question';
import { QuizQuestionSchema } from '@/models/schemas/QuizQuestionSchema';

const QuizQuestionModel =
  (mongoose.models['QuizQuestionMutation'] as mongoose.Model<mongoose.Document> | undefined) ??
  mongoose.model('QuizQuestionMutation', QuizQuestionSchema);

function singleQuestion(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    question: 'What is 2+2?',
    options: ['3', '4', '5'],
    type: 'single',
    correctIndex: 1,
    ...overrides,
  };
}

function multipleQuestion(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    question: 'Pick primes',
    options: ['2', '3', '4', '5'],
    type: 'multiple',
    correctIndexes: [0, 1, 3],
    ...overrides,
  };
}

async function expectValidationError(
  payload: Record<string, unknown>,
  message: string | RegExp,
): Promise<void> {
  const doc = new QuizQuestionModel(payload);
  await expect(doc.validate()).rejects.toThrow(message);
}

describe('QuizQuestionSchema mutation coverage', () => {
  describe('required fields and option bounds', () => {
    it('requires question text, options, and type with production messages', async () => {
      await expectValidationError(
        {},
        /Question text is required|Options are required|Question type is required/,
      );

      const missingQuestion = new QuizQuestionModel({
        options: ['A', 'B'],
        type: 'single',
        correctIndex: 0,
      });
      await expect(missingQuestion.validate()).rejects.toThrow('Question text is required');

      // Mongoose coerces a missing options array to [] before required checks run,
      // so the public failure surfaces through the length validator message.
      const missingOptions = new QuizQuestionModel({
        question: 'Q',
        type: 'single',
        correctIndex: 0,
      });
      await expect(missingOptions.validate()).rejects.toThrow(
        'Each question must have between 2 and 20 options',
      );
    });

    it('trims question text and rejects option arrays outside 2..20', async () => {
      const trimmed = new QuizQuestionModel(singleQuestion({ question: '  Hello  ' }));
      await expect(trimmed.validate()).resolves.toBeUndefined();
      expect(trimmed.get('question')).toBe('Hello');

      await expectValidationError(
        singleQuestion({ options: ['only-one'], correctIndex: 0 }),
        'Each question must have between 2 and 20 options',
      );

      await expectValidationError(
        singleQuestion({
          options: Array.from({ length: 21 }, (_, index) => `opt-${index}`),
          correctIndex: 0,
        }),
        'Each question must have between 2 and 20 options',
      );

      const boundary = new QuizQuestionModel(
        singleQuestion({
          options: Array.from({ length: 20 }, (_, index) => `opt-${index}`),
          correctIndex: 19,
        }),
      );
      await expect(boundary.validate()).resolves.toBeUndefined();
    });

    it('rejects missing type (no default single) and unknown enum values', async () => {
      const missingType = new QuizQuestionModel({
        question: 'Q',
        options: ['A', 'B'],
        correctIndex: 0,
      });
      await expect(missingType.validate()).rejects.toThrow(
        /Question type is required|Path `type` is required|required/,
      );
      expect(missingType.get('type')).toBeUndefined();

      await expectValidationError(
        singleQuestion({ type: 'boolean' }),
        /`boolean` is not a valid enum value|is not a valid enum value/,
      );
    });

    it('accepts normal canonical single and multiple discriminators', async () => {
      const single = new QuizQuestionModel(singleQuestion());
      await expect(single.validate()).resolves.toBeUndefined();
      expect(single.get('type')).toBe('single');
      expect(single.get('correctIndex')).toBe(1);
      expect(single.get('correctIndexes')).toBeUndefined();

      const multiple = new QuizQuestionModel(multipleQuestion());
      await expect(multiple.validate()).resolves.toBeUndefined();
      expect(multiple.get('type')).toBe('multiple');
      expect(multiple.get('correctIndexes')).toEqual([0, 1, 3]);
      expect(multiple.get('correctIndex')).toBeUndefined();
    });
  });

  describe('single-choice contract', () => {
    it('requires correctIndex only for single questions and validates integer bounds', async () => {
      await expectValidationError(
        singleQuestion({ correctIndex: undefined }),
        /Path `correctIndex` is required|required/,
      );

      await expectValidationError(
        singleQuestion({ correctIndex: 1.5 }),
        'Single choice questions must have a valid correct index within options range',
      );

      await expectValidationError(
        singleQuestion({ correctIndex: -1 }),
        'Single choice questions must have a valid correct index within options range',
      );

      await expectValidationError(
        singleQuestion({ correctIndex: 3 }),
        'Single choice questions must have a valid correct index within options range',
      );

      const valid = new QuizQuestionModel(singleQuestion({ correctIndex: 0 }));
      await expect(valid.validate()).resolves.toBeUndefined();
    });

    it('rejects single questions that also carry correctIndexes', async () => {
      await expectValidationError(
        singleQuestion({ correctIndexes: [0] }),
        'Single-choice question cannot have correctIndexes',
      );
    });
  });

  describe('multiple-choice contract', () => {
    it('requires non-empty unique integer indexes inside the options range', async () => {
      await expectValidationError(
        multipleQuestion({ correctIndexes: undefined }),
        /Path `correctIndexes` is required|required/,
      );

      await expectValidationError(
        multipleQuestion({ correctIndexes: [] }),
        'Multiple choice questions must have at least one valid correct index within options range',
      );

      await expectValidationError(
        multipleQuestion({ correctIndexes: [0, 0] }),
        'Multiple choice questions must have at least one valid correct index within options range',
      );

      await expectValidationError(
        multipleQuestion({ correctIndexes: [0.5] }),
        'Multiple choice questions must have at least one valid correct index within options range',
      );

      await expectValidationError(
        multipleQuestion({ correctIndexes: [-1] }),
        'Multiple choice questions must have at least one valid correct index within options range',
      );

      await expectValidationError(
        multipleQuestion({ correctIndexes: [4] }),
        'Multiple choice questions must have at least one valid correct index within options range',
      );

      const valid = new QuizQuestionModel(multipleQuestion({ correctIndexes: [0, 3] }));
      await expect(valid.validate()).resolves.toBeUndefined();
    });

    it('does not require correctIndex for multiple questions and rejects when present', async () => {
      const valid = new QuizQuestionModel(multipleQuestion());
      await expect(valid.validate()).resolves.toBeUndefined();
      expect(valid.get('correctIndex')).toBeUndefined();

      await expectValidationError(
        multipleQuestion({ correctIndex: 0 }),
        'Multiple-choice question cannot have correctIndex',
      );
    });
  });

  describe('images and option content', () => {
    it('allows optional questionImage and matching optionImages arrays', async () => {
      const withImages = new QuizQuestionModel(
        singleQuestion({
          questionImage: '  https://cdn.example/q.png  ',
          optionImages: [
            'https://cdn.example/a.png',
            'https://cdn.example/b.png',
            'https://cdn.example/c.png',
          ],
        }),
      );
      await expect(withImages.validate()).resolves.toBeUndefined();
      expect(withImages.get('questionImage')).toBe('https://cdn.example/q.png');

      const emptyImages = new QuizQuestionModel(singleQuestion({ optionImages: [] }));
      await expect(emptyImages.validate()).resolves.toBeUndefined();

      await expectValidationError(
        singleQuestion({ optionImages: ['https://cdn.example/a.png'] }),
        'Option images array length must match options array length',
      );
    });

    it('accepts image-only options and rejects options without text or image content', async () => {
      const imageOnly = new QuizQuestionModel(
        singleQuestion({
          options: ['', '  '],
          optionImages: ['https://cdn.example/a.png', 'https://cdn.example/b.png'],
          correctIndex: 0,
        }),
      );
      await expect(imageOnly.validate()).resolves.toBeUndefined();

      await expectValidationError(
        singleQuestion({
          options: ['', 'B'],
          correctIndex: 0,
        }),
        'Option requires text or an image',
      );

      await expectValidationError(
        singleQuestion({
          options: ['', 'B'],
          optionImages: ['   ', 'https://cdn.example/b.png'],
          correctIndex: 0,
        }),
        'Option requires text or an image',
      );
    });
  });

  describe('input-size ceilings', () => {
    it('accepts text and image fields at production max lengths', async () => {
      const atMax = new QuizQuestionModel(
        singleQuestion({
          question: 'q'.repeat(MAX_QUESTION_TEXT_LENGTH),
          options: [
            'a'.repeat(MAX_OPTION_TEXT_LENGTH),
            'b'.repeat(MAX_OPTION_TEXT_LENGTH),
            ...Array.from({ length: MAX_OPTION_COUNT - 2 }, (_, index) => `opt-${index}`),
          ],
          questionImage: 'u'.repeat(MAX_QUESTION_IMAGE_URL_LENGTH),
          optionImages: Array.from({ length: MAX_OPTION_COUNT }, () =>
            'i'.repeat(MAX_QUESTION_IMAGE_URL_LENGTH),
          ),
          correctIndex: 0,
        }),
      );
      await expect(atMax.validate()).resolves.toBeUndefined();
    });

    it('rejects oversized question text, option text, and image URLs', async () => {
      await expectValidationError(
        singleQuestion({ question: 'q'.repeat(MAX_QUESTION_TEXT_LENGTH + 1) }),
        `Question text cannot exceed ${MAX_QUESTION_TEXT_LENGTH} characters`,
      );

      await expectValidationError(
        singleQuestion({
          options: ['o'.repeat(MAX_OPTION_TEXT_LENGTH + 1), 'B'],
        }),
        `Option text cannot exceed ${MAX_OPTION_TEXT_LENGTH} characters`,
      );

      await expectValidationError(
        singleQuestion({
          questionImage: 'u'.repeat(MAX_QUESTION_IMAGE_URL_LENGTH + 1),
        }),
        `Question image URL cannot exceed ${MAX_QUESTION_IMAGE_URL_LENGTH} characters`,
      );

      await expectValidationError(
        singleQuestion({
          optionImages: [
            'u'.repeat(MAX_QUESTION_IMAGE_URL_LENGTH + 1),
            'https://cdn.example/b.png',
            'https://cdn.example/c.png',
          ],
        }),
        `Option image URL cannot exceed ${MAX_QUESTION_IMAGE_URL_LENGTH} characters`,
      );
    });
  });
});
