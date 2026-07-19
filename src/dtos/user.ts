import type { PaginationMeta } from '@/dtos/common';
import { z } from 'zod';
import { objectIdRouteParamSchema } from '@/lib/validation/common';

export const attemptIdRouteParamsSchema = z.strictObject({ id: objectIdRouteParamSchema });

export const userAttemptListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const attemptDetailQuerySchema = z.strictObject({
  userEmail: z.string().trim().pipe(z.email()).optional(),
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

export interface AttemptQuestionDetailDto {
  id: string;
  question: string;
  options: string[];
  type: 'single' | 'multiple';
  correctIndex?: number;
  correctIndexes?: number[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
  userAnswer: number | number[];
  isCorrect: boolean;
}

export interface AttemptDetailDto {
  id: string;
  score: number;
  totalQuestions: number;
  takenAt: string;
  answers: (number | number[])[];
  historyStatus: 'complete' | 'quiz_modified';
  quiz: {
    title: string;
    slug: string;
    description?: string;
    questions: AttemptQuestionDetailDto[];
  };
}
