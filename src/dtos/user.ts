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
  /** Quick round only (RIN-936): `totalQuestions` is the round size. */
  mode?: 'quick';
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

/** The result page's "next quiz" link (RIN-914); `quick` opens its quick round (RIN-1177). */
interface AttemptNextQuizDto {
  slug: string;
  title: string;
  quick?: boolean;
}

export interface AttemptDetailDto {
  id: string;
  score: number;
  totalQuestions: number;
  takenAt: string;
  answers: (number | number[])[];
  historyStatus: 'complete' | 'quiz_modified' | 'content_locked';
  quiz: {
    id: string;
    title: string;
    slug: string;
    description?: string;
    questions: AttemptQuestionDetailDto[];
    /** Public, non-Premium quiz whose result page may offer "Send to a classmate" (RIN-1179). */
    shareable: boolean;
    /** Questions in the live quiz; `totalQuestions` is this attempt's count (10 for a quick round). */
    questionCount: number;
  };
  /** Questions answered wrong or left blank in this attempt. */
  missedCount: number;
  /** Next eligible starter quiz in the learner's locale they have not attempted, or null. */
  nextQuiz: AttemptNextQuizDto | null;
  /** Retry-missed attempt only: the source attempt id. */
  retryOfAttemptId?: string;
  /** Retry or quick round: `quiz.questions[i]` is quiz question `questionIndices[i]`. */
  questionIndices?: number[];
  /** Quick round only (RIN-936). */
  mode?: 'quick';
}
