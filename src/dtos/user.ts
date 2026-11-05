import type { PaginationMeta } from '@/dtos/common';
import { z } from 'zod';
import { locales } from '@/i18n/config';
import { objectIdRouteParamSchema } from '@/lib/validation/common';
import type { QuizQuestionReview } from '@/shared/types/quiz-question';

export const attemptIdRouteParamsSchema = z.strictObject({ id: objectIdRouteParamSchema });

export const userAttemptListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const attemptDetailQuerySchema = z.strictObject({
  userEmail: z.string().trim().pipe(z.email()).optional(),
  /** Learner locale, used to pick `nextQuiz` (RIN-914). */
  locale: z.enum(locales).optional(),
});

/** Public profile identity — stable non-PII fields only (no email). */
export interface PublicProfileUserDto {
  id: string;
  name?: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  createdAt: string;
}

export interface PublicProfileQuizDto {
  id: string;
  title: string;
  description?: string;
  slug: string;
  createdAt: string;
  questionCount: number;
}

export interface PublicUserProfileDto {
  user: PublicProfileUserDto;
  quizzes: PublicProfileQuizDto[];
  pagination: PaginationMeta;
}

export interface PublicProfileQueryDto {
  page: number;
}
export type UserAttemptListQueryDto = z.infer<typeof userAttemptListQuerySchema>;

export interface UserAttemptSummaryDto {
  id: string;
  score: number;
  takenAt: string;
  totalQuestions: number;
  quiz: {
    title: string;
    slug: string;
    description?: string;
  };
}

export interface UserAttemptListDto {
  attempts: UserAttemptSummaryDto[];
  pagination: PaginationMeta;
}

export type AttemptQuestionDetailDto = QuizQuestionReview;

export interface AttemptDetailDto {
  id: string;
  score: number;
  totalQuestions: number;
  takenAt: string;
  answers: (number | number[])[];
  historyStatus: 'complete' | 'quiz_modified' | 'content_locked';
  quiz: {
    title: string;
    slug: string;
    description?: string;
    questions: AttemptQuestionDetailDto[];
  };
  /** Questions answered wrong or left blank in this attempt. */
  missedCount: number;
  /** Next allowlisted starter quiz in the learner's locale they have not attempted, or null. */
  nextQuiz: { slug: string; title: string } | null;
  /** Retry-missed attempt only: the source attempt id. */
  retryOfAttemptId?: string;
  /** Retry-missed attempt only: `quiz.questions[i]` is quiz question `questionIndices[i]`. */
  questionIndices?: number[];
}
