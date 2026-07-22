import { z } from 'zod';
import { MAX_QUIZ_PDF_BYTES } from '@/lib/quiz/constants';

const MAX_ADAPTIVE_PDF_BYTES = 50 * 1024 * 1024;

const baseUploadSchema = {
  fileName: z.string().trim().min(1, 'fileName is required'),
  contentType: z.literal('application/pdf'),
};

export const createPresignedUploadUrlRequestSchema = z.discriminatedUnion('purpose', [
  z.strictObject({
    ...baseUploadSchema,
    purpose: z.literal('quiz'),
    fileSize: z.number().finite().positive().max(MAX_QUIZ_PDF_BYTES),
  }),
  z.strictObject({
    ...baseUploadSchema,
    purpose: z.literal('adaptive'),
    fileSize: z.number().finite().positive().max(MAX_ADAPTIVE_PDF_BYTES),
  }),
]);

export interface PresignedUploadUrlResponseDto {
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
}
