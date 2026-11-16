import { z } from 'zod';
import { objectIdSchema } from '@/lib/validation/common';
import { premiumRightsRefinement, quizComposeBaseFields } from '@/dtos/quiz';
import { quizTextSchema } from '@/dtos/quiz-text-source';
import type { components } from '@/generated/adaptive-api';

type AdaptiveSchemas = components['schemas'];

// `error_code` is not in the published draft schema yet (RIN-565): Path B jobs
// already carry one, and drafts are expected to follow. Reading it as optional
// lets the failure toast pick it up as soon as the API sends it.
export type QuizDraftTransportDto = AdaptiveSchemas['QuizDraftResponseData'] & {
  error_code?: string | null;
};
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

/**
 * `POST /api/quiz-drafts/text` (RIN-1538), snake_case like the API's draft create. Bounds
 * mirror `QuizDraftCreateRequest`, so a bad request never reaches the API.
 */
export const createTextQuizDraftRequestSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  text: quizTextSchema,
  description: z.string().max(1000).nullable().optional(),
  category_id: objectIdSchema.nullable().optional(),
  prompt: z.string().max(2000).nullable().optional(),
  submit_to_premium: z.boolean().optional(),
  /** Set when the browser extracted the text from a Word or PowerPoint file (RIN-1787). */
  source_file_type: z.enum(['docx', 'pptx']).optional(),
  /** Which create page that was, for the daily office counter; never forwarded to the API. */
  upload_surface: z.enum(['create_pdf', 'create_pdf_mobile']).optional(),
});

/** Where an office-file text draft was picked (RIN-1787). */
type OfficeDraftSurface = 'create_pdf' | 'create_pdf_mobile';

export interface CreateTextQuizDraftInputDto {
  title: string;
  text: string;
  folderId?: string | null;
  description?: string;
  prompt?: string;
  submitToPremium?: boolean;
  /** A text read from a .docx or .pptx in the browser (RIN-1787); the file is never uploaded. */
  office?: { fileType: 'docx' | 'pptx'; surface: OfficeDraftSurface };
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
