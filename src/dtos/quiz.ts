import type { PaginationMeta } from '@/dtos/common';
import { z } from 'zod';
import { questionListSchema } from '@/lib/validation/question';
import {
  objectIdSchema,
  objectIdRouteParamSchema,
  routePathSegmentSchema,
  slugRouteParamSchema,
} from '@/lib/validation/common';
import { UNFILED_FOLDER_TARGET } from '@/shared/constants/folder';

const queryBooleanSchema = z.enum(['true', 'false']).transform((value) => value === 'true');

export const quizIdRouteParamsSchema = z.strictObject({ id: objectIdRouteParamSchema });
export const quizSlugRouteParamsSchema = z.strictObject({ slug: slugRouteParamSchema });
export const quizDraftIdRouteParamsSchema = z.strictObject({ id: routePathSegmentSchema });

export const quizListQuerySchema = z.strictObject({
  search: z.string().trim().min(1).max(200).optional(),
  folder: z.union([z.literal(UNFILED_FOLDER_TARGET), objectIdSchema]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  mine: queryBooleanSchema.default(false),
  visibility: z.enum(['public', 'private']).optional(),
});

export const reportQuizRequestSchema = z.strictObject({
  content: z.string().trim().min(1, 'Report content is required').max(2000),
});

export const createQuizRequestSchema = z.strictObject({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(1000).optional(),
  folderId: z.string().trim().min(1).nullable().optional(),
  questions: questionListSchema,
  isPrivate: z.boolean(),
  pdfUrl: z.url().optional(),
});

export const updateQuizRequestSchema = z
  .strictObject({
    title: z.string().trim().min(1, 'Title is required').max(200).optional(),
    description: z.string().trim().max(1000).optional(),
    folder: z.string().trim().min(1).nullable().optional(),
    questions: questionListSchema.optional(),
    isPrivate: z.boolean().optional(),
    pdfUrl: z.url().optional(),
  })
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    'No quiz fields provided',
  );

export type CreateQuizRequestDto = z.infer<typeof createQuizRequestSchema>;
export type UpdateQuizRequestDto = z.infer<typeof updateQuizRequestSchema>;
type QuizQuestionInputDto = z.infer<typeof questionListSchema>[number];

export interface QuizListOptionsDto {
  search?: string;
  folder?: string | null;
  page: number;
  limit: number;
  isPrivate?: boolean;
  userId?: string;
  onlyMine: boolean;
}

/** Public author identity — stable non-PII fields only (no email). */
export interface QuizListAuthorDto {
  id: string;
  name?: string;
  displayName?: string;
  avatar?: string;
}

export interface QuizListItemDto {
  id: string;
  title: string;
  description?: string;
  slug: string;
  author: QuizListAuthorDto | null;
  folder: string | null;
  isPrivate: boolean;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export type QuizQuestionDto = QuizQuestionInputDto & {
  id: string;
};

export interface PlayableQuizQuestionDto {
  id: string;
  question: string;
  options: string[];
  type: 'single' | 'multiple';
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

export interface QuizDetailDto extends QuizListItemDto {
  questions: QuizQuestionDto[];
  pdfUrl?: string;
  tags?: string[];
}

export interface QuizPlayDetailDto extends Omit<QuizDetailDto, 'questions'> {
  questions: PlayableQuizQuestionDto[];
}

export interface QuizListDto {
  quizzes: QuizListItemDto[];
  pagination: PaginationMeta;
}

export interface DiscussionCommentDto {
  id: string;
  author: {
    id: string;
    name?: string;
    avatar?: string;
  };
  content: string;
  isEdited: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface QuizDiscussionDto {
  id: string;
  questionIndex: number;
  comments: DiscussionCommentDto[];
  createdAt: string;
  updatedAt: string;
}

export interface FlashcardQuestionDto {
  id: string;
  question: string;
  options: string[];
  type: 'single' | 'multiple';
  correctIndex?: number;
  correctIndexes?: number[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

export interface FlashcardQuizDto {
  id: string;
  title: string;
  slug: string;
  description?: string;
  questions: FlashcardQuestionDto[];
}

export interface QuizAttemptResultDto {
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  attemptId: string;
}

const quizProgressAnswerSchema = z.union([
  z.number().int().min(-1),
  z.array(z.number().int().min(0)).max(20),
]);

export const submitQuizAttemptRequestSchema = z.strictObject({
  answers: z.array(quizProgressAnswerSchema),
  idempotencyKey: z.uuid(),
  userEmail: z.string().trim().toLowerCase().pipe(z.email()).optional(),
});

export const addDiscussionCommentRequestSchema = z.strictObject({
  questionIndex: z.number().int().min(0),
  content: z.string().trim().min(1, 'Comment content is required').max(2000),
});

function isDenseIndexPermutation(order: readonly number[], size: number): boolean {
  if (order.length !== size) {
    return false;
  }
  const seen = new Set<number>();
  for (const value of order) {
    if (!Number.isInteger(value) || value < 0 || value >= size || seen.has(value)) {
      return false;
    }
    seen.add(value);
  }
  return seen.size === size;
}

export const savedQuizProgressSchema = z
  .strictObject({
    questionOrder: z.array(z.number().int().min(0)),
    optionOrders: z.array(z.array(z.number().int().min(0))),
    userAnswers: z.array(quizProgressAnswerSchema),
    currentQuestionIndex: z.number().int().min(0),
    answeredCount: z.number().int().min(0),
    totalQuestions: z.number().int().min(0),
  })
  .superRefine((progress, ctx) => {
    const { totalQuestions } = progress;

    if (
      progress.questionOrder.length !== totalQuestions ||
      progress.optionOrders.length !== totalQuestions ||
      progress.userAnswers.length !== totalQuestions
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Progress payload length mismatch',
      });
      return;
    }

    if (totalQuestions === 0) {
      if (progress.currentQuestionIndex !== 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid current question index',
          path: ['currentQuestionIndex'],
        });
      }
      if (progress.answeredCount !== 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid answered count',
          path: ['answeredCount'],
        });
      }
      return;
    }

    if (progress.currentQuestionIndex >= totalQuestions) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid current question index',
        path: ['currentQuestionIndex'],
      });
    }

    if (progress.answeredCount > totalQuestions) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid answered count',
        path: ['answeredCount'],
      });
    }

    const derivedAnsweredCount = progress.userAnswers.reduce<number>((count, answer) => {
      if (Array.isArray(answer)) {
        return count + (answer.length > 0 ? 1 : 0);
      }
      return count + (answer >= 0 ? 1 : 0);
    }, 0);
    if (progress.answeredCount !== derivedAnsweredCount) {
      ctx.addIssue({
        code: 'custom',
        message: 'Answered count does not match user answers',
        path: ['answeredCount'],
      });
    }

    if (!isDenseIndexPermutation(progress.questionOrder, totalQuestions)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid question order',
        path: ['questionOrder'],
      });
    }

    progress.optionOrders.forEach((optionOrder, index) => {
      if (optionOrder.length === 0 || !isDenseIndexPermutation(optionOrder, optionOrder.length)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid option order',
          path: ['optionOrders', index],
        });
      }
    });
  });

export type SavedQuizProgressDto = z.infer<typeof savedQuizProgressSchema>;

export interface QuizProgressResponseDto {
  progress: SavedQuizProgressDto | null;
}

export interface SaveQuizProgressResponseDto {
  saved: true;
}

export interface DeleteQuizProgressResponseDto {
  deleted: true;
}

export interface ReportQuizResponseDto {
  reportId: string;
}
