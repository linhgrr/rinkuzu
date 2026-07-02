import { z } from 'zod';

export const createPresignedUploadUrlRequestSchema = z
  .object({
    fileName: z.string().trim().min(1, 'fileName is required'),
    contentType: z.literal('application/pdf'),
    fileSize: z
      .number()
      .finite()
      .positive()
      .max(50 * 1024 * 1024),
    purpose: z.enum(['quiz', 'adaptive']),
  })
  .strict();

export interface PresignedUploadUrlResponseDto {
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
}

export type CreatePresignedUploadUrlRequestDto = z.infer<
  typeof createPresignedUploadUrlRequestSchema
>;
