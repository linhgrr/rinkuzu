import { z } from 'zod';
import { questionListSchema } from '@/lib/validation/question';
import { objectIdSchema } from '@/lib/validation/common';
import type { components } from '@/generated/adaptive-api';

type AdaptiveSchemas = components['schemas'];

export type QuizDraftTransportDto = AdaptiveSchemas['QuizDraftResponseData'];
export type QuizDraftSingleResponseDto = { draft: QuizDraftTransportDto };
export type QuizDraftListResponseDto = { drafts: QuizDraftTransportDto[] };
type QuizDraftCreateTransportDto = AdaptiveSchemas['QuizDraftCreateRequest'];

export interface CreateQuizDraftInputDto {
  title: QuizDraftCreateTransportDto['title'];
  s3Key: QuizDraftCreateTransportDto['s3_key'];
  fileName: QuizDraftCreateTransportDto['file_name'];
  fileSize: NonNullable<QuizDraftCreateTransportDto['file_size']>;
  folderId?: QuizDraftCreateTransportDto['category_id'];
  description?: QuizDraftCreateTransportDto['description'];
  prompt?: QuizDraftCreateTransportDto['prompt'];
  isPrivate?: boolean;
}

export interface CreateManualQuizDraftInputDto {
  title: AdaptiveSchemas['QuizManualDraftCreateRequest']['title'];
  description?: AdaptiveSchemas['QuizManualDraftCreateRequest']['description'];
  folderId?: AdaptiveSchemas['QuizManualDraftCreateRequest']['category_id'];
  isPrivate?: AdaptiveSchemas['QuizManualDraftCreateRequest']['is_private'];
}

export interface PatchQuizDraftInputDto {
  title?: string;
  description?: string;
  folderId?: string | null;
  isPrivate?: boolean;
  questions?: SubmitQuizDraftRequestDto['questions'];
  expectedRevision: number;
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
