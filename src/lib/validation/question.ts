import { z } from 'zod';

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
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, 'Cannot be blank');

const optionSchema = z.string().transform((value) => value.trim());

const baseQuestion = z.object({
  question: trimmedString,
  options: z.array(optionSchema).min(2, 'Need at least 2 options').max(20, 'Too many options'),
  questionImage: z.string().optional(),
  optionImages: z.array(z.string().optional()).optional(),
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
  .min(1, 'At least one question is required');

export function getQuestionListWarnings(questionCount: number): string[] {
  return questionCount < 5 ? ['Quiz nên có ít nhất 5 câu hỏi'] : [];
}
