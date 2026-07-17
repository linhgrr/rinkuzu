import { z } from 'zod';
import type { QuizLibraryStatus } from '@/shared/types/quiz-library';
import type { PaginationMeta } from '@/dtos/common';
import { UNFILED_FOLDER_TARGET } from '@/shared/constants/folder';
import { objectIdSchema } from '@/lib/validation/common';

const srsRatingSchema = z.enum(['fail', 'hard', 'good', 'easy']);

const questionReferenceSchema = z.object({
  text: z.string(),
  options: z.array(z.string()),
  correctIndexes: z.array(z.number().int().min(0)),
});

export type QuestionReferenceDto = z.infer<typeof questionReferenceSchema>;

export const submitReviewRequestSchema = z.object({
  questionId: z.string().trim().min(1, 'Question id is required'),
  quizSlug: z.string().trim().min(1, 'Quiz slug is required'),
  rating: srsRatingSchema,
  questionRef: questionReferenceSchema.optional(),
});

export const libraryListQuerySchema = z.strictObject({
  folder: z
    .union([z.literal(UNFILED_FOLDER_TARGET), objectIdSchema])
    .optional()
    .transform((target) => (target === UNFILED_FOLDER_TARGET ? null : target)),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

interface LibraryQuizAuthorDto {
  id: string;
  email?: string;
  name?: string;
  displayName?: string;
  avatar?: string;
}

export interface LibraryQuizDto {
  id: string;
  title: string;
  slug: string;
  description?: string;
  author: LibraryQuizAuthorDto | null;
  folder: string | null;
  questions: [];
  isPrivate: boolean;
  pdfUrl?: string;
  questionCount: number;
  ownedByMe: boolean;
  createdAt: string;
  updatedAt: string;
  lastAttemptAt: string | null;
  lastProgressAt: string | null;
  libraryStatus: QuizLibraryStatus;
  displayDate: string;
}

export interface LibraryListDto {
  quizzes: LibraryQuizDto[];
  pagination: PaginationMeta;
}

export interface DueReviewQuestionDto {
  id: string;
  userId: string;
  quizSlug: string;
  questionId: string;
  questionRef?: QuestionReferenceDto;
  srsLevel: number;
  nextReviewDate: string;
  lastReviewDate: string | null;
  interval: number;
  easeFactor: number;
  correctStreak: number;
  totalReviews: number;
  totalCorrect: number;
  history: Array<{
    date: string;
    rating: 'fail' | 'hard' | 'good' | 'easy';
  }>;
  isBookmarked: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface DueReviewListDto {
  questions: DueReviewQuestionDto[];
  count: number;
}

export interface SubmitReviewResponseDto {
  questionProgress: DueReviewQuestionDto;
  userProgress: {
    xp: number;
    streak: number;
    xpGained: number;
    streakFreezeUsed: boolean;
  };
}

export interface BuyStreakFreezeResponseDto {
  xp: number;
  streakFreezeCount: number;
}

export type SubmitReviewRequestDto = z.infer<typeof submitReviewRequestSchema>;
export type LibraryListQueryDto = z.infer<typeof libraryListQuerySchema>;
