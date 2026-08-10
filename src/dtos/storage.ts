import { z } from 'zod';
import { MAX_PDF_UPLOAD_BYTES, MAX_PDF_UPLOAD_MB } from '@/lib/pdf-upload-policy';
import { MAX_QUIZ_PDF_BYTES } from '@/lib/quiz/constants';

export { MAX_PDF_UPLOAD_BYTES, MAX_PDF_UPLOAD_MB };

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
    fileSize: z.number().finite().positive().max(MAX_PDF_UPLOAD_BYTES),
  }),
]);

export interface PresignedUploadUrlResponseDto {
  uploadUrl: string;
  uploadMethod?: 'PUT' | 'POST';
  uploadHeaders?: Record<string, string>;
  uploadFields: Record<string, string>;
  s3Key: string;
  expiresIn: number;
}

export const deletePendingUploadRequestSchema = z.discriminatedUnion('purpose', [
  z.strictObject({
    purpose: z.literal('quiz'),
    s3Key: z.string().trim().min(1),
  }),
  z.strictObject({
    purpose: z.literal('adaptive'),
    s3Key: z.string().trim().min(1),
  }),
]);
