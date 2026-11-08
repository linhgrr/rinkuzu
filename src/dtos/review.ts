import { z } from 'zod';
import type { QuizLibraryStatus } from '@/shared/types/quiz-library';
import type { PaginationMeta } from '@/dtos/common';
import { UNFILED_FOLDER_TARGET } from '@/shared/constants/folder';
import { objectIdSchema } from '@/lib/validation/common';
import { SRS_RATINGS, type SRSRating } from '@/shared/constants/srs-rating';

const srsRatingSchema = z.enum(SRS_RATINGS);

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

const LIBRARY_STATUS_FILTERS = ['in_progress', 'complete'] as const satisfies readonly Exclude<
  QuizLibraryStatus,
  'not_started'
>[];
const LIBRARY_SEARCH_MAX_LENGTH = 80;

export const libraryListQuerySchema = z.strictObject({
  folder: z
    .union([z.literal(UNFILED_FOLDER_TARGET), objectIdSchema])
    .optional()
    .transform((target) => (target === UNFILED_FOLDER_TARGET ? null : target)),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  status: z.enum(LIBRARY_STATUS_FILTERS).optional(),
  q: z.string().trim().min(1).max(LIBRARY_SEARCH_MAX_LENGTH).optional(),
});

/** Public library author identity — stable non-PII fields only (no email). */
interface LibraryQuizAuthorDto {
  id: string;
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
  visibility: 'public' | 'personal';
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

/** Whole-library counts for the current folder scope; independent of status, q and page. */
interface LibraryCountsDto {
  all: number;
  inProgress: number;
  complete: number;
}

export interface LibraryListDto {
  quizzes: LibraryQuizDto[];
  /** Reflects the filtered list (status and q applied). */
  pagination: PaginationMeta;
  counts: LibraryCountsDto;
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
    rating: SRSRating;
  }>;
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
