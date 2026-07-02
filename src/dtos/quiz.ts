import type { PaginationMeta } from '@/dtos/common';
import { z } from 'zod';
import { questionListSchema } from '@/lib/validation/question';
import { objectIdSchema } from '@/lib/validation/common';
import { UNFILED_FOLDER_TARGET } from '@/shared/constants/folder';

const queryBooleanSchema = z.enum(['true', 'false']).transform((value) => value === 'true');

export const quizListQuerySchema = z
  .object({
    search: z.string().trim().min(1).max(200).optional(),
    folder: z.union([z.literal(UNFILED_FOLDER_TARGET), objectIdSchema]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    mine: queryBooleanSchema.default(false),
    compact: queryBooleanSchema.default(false),
    visibility: z.enum(['public', 'private']).optional(),
  })
  .strict();

export const reportQuizRequestSchema = z
  .object({
    content: z.string().trim().min(1, 'Report content is required').max(2000),
  })
  .strict();

export const createQuizRequestSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    description: z.string().trim().max(1000).optional(),
    folderId: z.string().trim().min(1).nullable().optional(),
    questions: questionListSchema,
    isPrivate: z.boolean(),
    pdfUrl: z.string().trim().url().optional(),
  })
  .strict();

export const updateQuizRequestSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200).optional(),
    description: z.string().trim().max(1000).optional(),
    folder: z.string().trim().min(1).nullable().optional(),
    questions: questionListSchema.optional(),
    isPrivate: z.boolean().optional(),
    pdfUrl: z.string().trim().url().optional(),
  })
  .strict()
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    'No quiz fields provided',
  );

export type CreateQuizRequestDto = z.infer<typeof createQuizRequestSchema>;
export type UpdateQuizRequestDto = z.infer<typeof updateQuizRequestSchema>;
export type QuizQuestionInputDto = z.infer<typeof questionListSchema>[number];

export interface QuizListOptionsDto {
  search?: string;
  folder?: string | null;
  page: number;
  limit: number;
  isPrivate?: boolean;
  userRole?: string;
  userId?: string;
  onlyMine: boolean;
  compact: boolean;
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
  author: string | QuizListAuthorDto | null;
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

const quizProgressAnswerSchema = z.union([z.number(), z.array(z.number())]);

export const submitQuizAttemptRequestSchema = z
  .object({
    answers: z.array(quizProgressAnswerSchema),
    userEmail: z.string().trim().email().optional(),
  })
  .strict();

export const addDiscussionCommentRequestSchema = z
  .object({
    questionIndex: z.number().int().min(0),
    content: z.string().trim().min(1, 'Comment content is required').max(2000),
  })
  .strict();

export const savedQuizProgressSchema = z
  .object({
    questionOrder: z.array(z.number()),
    optionOrders: z.array(z.array(z.number())),
    userAnswers: z.array(quizProgressAnswerSchema),
    currentQuestionIndex: z.number().int().min(0),
    answeredCount: z.number().int().min(0),
    totalQuestions: z.number().int().min(0),
  })
  .strict()
  .refine(
    (progress) =>
      progress.questionOrder.length === progress.totalQuestions &&
      progress.optionOrders.length === progress.totalQuestions &&
      progress.userAnswers.length === progress.totalQuestions,
    'Progress payload length mismatch',
  );

export type SavedQuizProgressDto = z.infer<typeof savedQuizProgressSchema>;
export type SubmitQuizAttemptRequestDto = z.infer<typeof submitQuizAttemptRequestSchema>;
export type AddDiscussionCommentRequestDto = z.infer<typeof addDiscussionCommentRequestSchema>;

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

export type ReportQuizRequestDto = z.infer<typeof reportQuizRequestSchema>;
