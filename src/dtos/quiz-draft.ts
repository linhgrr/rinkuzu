import { z } from 'zod';
import { questionListSchema } from '@/lib/validation/question';
import { objectIdSchema } from '@/lib/validation/common';
import type { components } from '@/generated/adaptive-api';
import type { QuizQuestionInputDto } from '@/dtos/quiz';

type AdaptiveSchemas = components['schemas'];

export type QuizDraftTransportDto = AdaptiveSchemas['QuizDraftResponseData'];
export type QuizDraftSingleResponseDto = AdaptiveSchemas['QuizDraftSingleResponse'];
export type QuizDraftListResponseDto = AdaptiveSchemas['QuizDraftListResponse'];

export interface CreateQuizDraftInputDto {
  title: string;
  s3Key: string;
  fileName: string;
  fileSize: number;
  folderId?: string | null;
  description?: string;
  prompt?: string;
}

export interface PatchQuizDraftInputDto {
  title?: string;
  description?: string;
  folderId?: string | null;
  questions?: QuizQuestionInputDto[];
}

export interface SubmitQuizDraftInputDto {
  title: string;
  folderId?: string | null;
  description?: string;
  questions: QuizQuestionInputDto[];
  isPrivate: boolean;
}

export interface SubmitQuizDraftResultDto {
  quizId: string;
  slug: string;
  warnings: string[];
}

export const submitQuizDraftRequestSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(1000).optional(),
  folderId: objectIdSchema.nullable().optional(),
  questions: questionListSchema,
  isPrivate: z.boolean(),
});

export type SubmitQuizDraftRequestDto = z.infer<typeof submitQuizDraftRequestSchema>;
