import { z } from 'zod';

/**
 * Production input-size ceilings for quiz question payloads.
 * Shared by request validation (`questionListSchema`) and
 * `QuizQuestionSchema` so create/update/import/submit reject the same
 * oversized inputs before they reach BSON or downstream services.
 *
 * Rationale:
 * - Question count 200: allows large exam/PDF extractions while bounding
 *   request body and Mongo document growth under the 16MB BSON limit when
 *   combined with per-field caps below.
 * - Question text 2000: matches product comment/report content caps.
 * - Option text 500: generous for multi-sentence choices; options stay short.
 * - Option count 2..20: existing product rule (keep unchanged).
 * - Image URLs 2048: practical URL length safety (CDN/imgbb URLs are short).
 */
export const MAX_QUESTIONS_PER_QUIZ = 200;
export const MAX_QUESTION_TEXT_LENGTH = 2000;
export const MAX_OPTION_TEXT_LENGTH = 500;
export const MIN_OPTION_COUNT = 2;
export const MAX_OPTION_COUNT = 20;
export const MAX_QUESTION_IMAGE_URL_LENGTH = 2048;

/**
 * Question shape used by draft / quiz submission flows.
 *
 * Mirrors `QuizQuestion` in src/entities/Quiz.ts — keep them in sync.
 * Validation rules:
 *   - 2..20 options; every option has text or a corresponding image
 *   - `single`: `correctIndex` is a valid index of `options`
 *   - `multiple`: `correctIndexes` non-empty, all valid + unique
 */
const trimmedString = z
  .string()
  .min(1, 'Required')
  .max(
    MAX_QUESTION_TEXT_LENGTH,
    `Question text must be at most ${MAX_QUESTION_TEXT_LENGTH} characters`,
  )
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, 'Cannot be blank');

const optionSchema = z
  .string()
  .max(MAX_OPTION_TEXT_LENGTH, `Option text must be at most ${MAX_OPTION_TEXT_LENGTH} characters`)
  .transform((value) => value.trim());

const imageUrlSchema = z
  .string()
  .max(
    MAX_QUESTION_IMAGE_URL_LENGTH,
    `Image URL must be at most ${MAX_QUESTION_IMAGE_URL_LENGTH} characters`,
  );

const baseQuestion = z.object({
  question: trimmedString,
  options: z
    .array(optionSchema)
    .min(MIN_OPTION_COUNT, 'Need at least 2 options')
    .max(MAX_OPTION_COUNT, 'Too many options'),
  questionImage: imageUrlSchema.optional(),
  optionImages: z.array(imageUrlSchema.optional()).optional(),
});

const singleChoiceQuestionSchema = baseQuestion
  .extend({
    type: z.literal('single'),
    correctIndex: z.number().int().nonnegative(),
  })
  .strict()
  .refine((q) => q.correctIndex < q.options.length, {
    message: 'correctIndex out of range',
    path: ['correctIndex'],
  });

const multipleChoiceQuestionSchema = baseQuestion
  .extend({
    type: z.literal('multiple'),
    correctIndexes: z
      .array(z.number().int().nonnegative())
      .min(1, 'Need at least 1 correct answer'),
  })
  .strict()
  .refine((q) => q.correctIndexes.every((idx) => idx < q.options.length), {
    message: 'correctIndexes out of range',
    path: ['correctIndexes'],
  })
  .refine((q) => new Set(q.correctIndexes).size === q.correctIndexes.length, {
    message: 'Duplicate correct indexes are not allowed',
    path: ['correctIndexes'],
  });

const questionSchema = z
  .discriminatedUnion('type', [singleChoiceQuestionSchema, multipleChoiceQuestionSchema])
  .superRefine((question, context) => {
    const optionImages = question.optionImages;
    if (
      optionImages &&
      optionImages.length !== 0 &&
      optionImages.length !== question.options.length
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Option images array length must match options array length',
        path: ['optionImages'],
      });
      return;
    }

    question.options.forEach((option, index) => {
      const image = optionImages?.[index];
      if (option.length === 0 && !(typeof image === 'string' && image.trim().length > 0)) {
        context.addIssue({
          code: 'custom',
          message: 'Option requires text or an image',
          path: ['options', index],
        });
      }
    });
  });

export const questionListSchema = z
  .array(questionSchema)
  .min(1, 'At least one question is required')
  .max(MAX_QUESTIONS_PER_QUIZ, 'Too many questions');

export function getQuestionListWarnings(questionCount: number): string[] {
  return questionCount < 5 ? ['Quiz nên có ít nhất 5 câu hỏi'] : [];
}
