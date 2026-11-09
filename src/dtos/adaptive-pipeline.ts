import { z } from 'zod';
import { locales } from '@/i18n/config';
import { routePathSegmentSchema } from '@/lib/validation/common';

// The UI locale the learner is using. The API decides the content language from the
// document; this only breaks ties and fills in legacy subjects (RIN-1262).
const adaptiveUiLocaleSchema = z.enum(locales);

const adaptiveSubjectIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[\p{L}\p{N}\p{M}_ .,:;()\-\/+&']+$/u);

export const adaptivePipelineProcessRequestSchema = z.strictObject({
  // Ownership is enforced server-side against the authenticated userId
  // (see resolveOwnedAdaptivePipelineS3Key). DTO only bounds length/emptiness.
  s3Key: z.string().min(1).max(1024),
  filename: z.string().min(1),
  subject_id: adaptiveSubjectIdSchema.optional(),
  page_batch_size: z.number().int().min(1).max(50).default(10),
  locale: adaptiveUiLocaleSchema.optional(),
});

export const adaptivePipelineJobsQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const adaptivePipelineJobQuerySchema = z.strictObject({
  include_debug: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export const adaptivePipelineSessionCreateQuerySchema = z.strictObject({
  max_steps: z.coerce.number().int().min(5).max(10_000).default(9999),
  locale: adaptiveUiLocaleSchema.optional(),
});

export const adaptivePipelineJobRetryQuerySchema = z.strictObject({
  locale: adaptiveUiLocaleSchema.optional(),
});

export const adaptivePipelineJobRouteParamsSchema = z.strictObject({
  jobId: routePathSegmentSchema,
});
