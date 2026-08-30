import { z } from 'zod';
import { objectIdSchema } from '@/lib/validation/common';
import { premiumRightsRefinement, quizComposeBaseFields } from '@/dtos/quiz';
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
  submitToPremium?: boolean;
}

export interface CreateManualQuizDraftInputDto {
  title: AdaptiveSchemas['QuizManualDraftCreateRequest']['title'];
  description?: AdaptiveSchemas['QuizManualDraftCreateRequest']['description'];
  folderId?: AdaptiveSchemas['QuizManualDraftCreateRequest']['category_id'];
  submitToPremium?: AdaptiveSchemas['QuizManualDraftCreateRequest']['submit_to_premium'];
}

export interface PatchQuizDraftInputDto {
  title?: string;
  description?: string;
  folderId?: string | null;
  submitToPremium?: boolean;
  questions?: SubmitQuizDraftRequestDto['questions'];
  expectedRevision: number;
}

export interface SubmitQuizDraftResultDto {
  quizId: string;
  slug: string;
  warnings: string[];
}

export const submitQuizDraftRequestSchema = z
  .strictObject({
    ...quizComposeBaseFields,
    folderId: objectIdSchema.nullable().optional(),
  })
  .superRefine(premiumRightsRefinement);

export type SubmitQuizDraftRequestDto = z.infer<typeof submitQuizDraftRequestSchema>;
