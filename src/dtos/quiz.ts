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

export interface QuizListAuthorDto {
  id: string;
  email?: string;
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
    email: string;
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
  z.number().int(),
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

export const savedQuizProgressSchema = z
  .strictObject({
    questionOrder: z.array(z.number()),
    optionOrders: z.array(z.array(z.number())),
    userAnswers: z.array(quizProgressAnswerSchema),
    currentQuestionIndex: z.number().int().min(0),
    answeredCount: z.number().int().min(0),
    totalQuestions: z.number().int().min(0),
  })
  .refine(
    (progress) =>
      progress.questionOrder.length === progress.totalQuestions &&
      progress.optionOrders.length === progress.totalQuestions &&
      progress.userAnswers.length === progress.totalQuestions,
    'Progress payload length mismatch',
  );

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
