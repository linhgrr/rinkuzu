import { z } from 'zod';

/**
 * Question shape used by draft / quiz submission flows.
 *
 * Mirrors `IQuestion` in src/models/Quiz.ts — keep them in sync.
 * Validation rules:
 *   - 2..20 options, each non-empty after trim
 *   - `single`: `correctIndex` is a valid index of `options`
 *   - `multiple`: `correctIndexes` non-empty, all valid + unique
 */
const trimmedString = z
  .string()
  .min(1, 'Required')
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, 'Cannot be blank');

export const optionSchema = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, 'Option cannot be empty');

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
    correctIndexes: z.array(z.number().int().nonnegative()).optional(),
  })
  .refine((q) => q.correctIndex < q.options.length, {
    message: 'correctIndex out of range',
    path: ['correctIndex'],
  });

const multipleChoiceQuestionSchema = baseQuestion
  .extend({
    type: z.literal('multiple'),
    correctIndex: z.number().int().nonnegative().optional(),
    correctIndexes: z
      .array(z.number().int().nonnegative())
      .min(1, 'Need at least 1 correct answer'),
  })
  .refine((q) => q.correctIndexes.every((idx) => idx < q.options.length), {
    message: 'correctIndexes out of range',
    path: ['correctIndexes'],
  })
  .refine((q) => new Set(q.correctIndexes).size === q.correctIndexes.length, {
    message: 'Duplicate correct indexes are not allowed',
    path: ['correctIndexes'],
  });

const questionSchema = z.discriminatedUnion('type', [
  singleChoiceQuestionSchema,
  multipleChoiceQuestionSchema,
]);

const questionListSchema = z.array(questionSchema).min(1, 'At least one question is required');

export type QuestionInput = z.infer<typeof questionSchema>;
export type SingleChoiceQuestion = z.infer<typeof singleChoiceQuestionSchema>;
export type MultipleChoiceQuestion = z.infer<typeof multipleChoiceQuestionSchema>;

export interface QuestionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  questions: QuestionInput[];
}

/**
 * Validate a list of question payloads against the schema.
 *
 * Returns parsed/normalised questions plus a flat error list (1 entry per
 * issue, prefixed with the 1-based question index) and non-blocking warnings.
 */
export function validateQuestionList(input: unknown): QuestionValidationResult {
  const result = questionListSchema.safeParse(input);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const [first, ...rest] = issue.path;
      const indexLabel = typeof first === 'number' ? `Câu ${first + 1}` : '';
      const fieldPath = rest.length > 0 ? rest.join('.') : '';
      const prefix = [indexLabel, fieldPath].filter(Boolean).join(' / ');
      return prefix ? `${prefix}: ${issue.message}` : issue.message;
    });
    return { isValid: false, errors, warnings: [], questions: [] };
  }

  const warnings: string[] = [];
  if (result.data.length < 5) {
    warnings.push('Quiz nên có ít nhất 5 câu hỏi');
  }

  return { isValid: true, errors: [], warnings, questions: result.data };
}
