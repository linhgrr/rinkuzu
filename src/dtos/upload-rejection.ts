import { z } from 'zod';
import {
  UPLOAD_REJECTION_REASONS,
  UPLOAD_SIZE_BUCKETS,
  UPLOAD_SURFACES,
  normalizeUploadExt,
} from '@/shared/constants/upload-counters';

/**
 * `POST /api/upload-rejections` body (RIN-1785). Every field is an allow-list
 * value; an unknown extension is stored as `other`, anything else is a 400.
 */
export const uploadRejectionRequestSchema = z
  .object({
    ext: z
      .string()
      .max(64)
      .transform((value) => normalizeUploadExt(value.toLowerCase())),
    reason: z.enum(UPLOAD_REJECTION_REASONS),
    surface: z.enum(UPLOAD_SURFACES),
    sizeBucket: z.enum(UPLOAD_SIZE_BUCKETS),
  })
  .strict();
