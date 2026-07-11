import { z } from 'zod';
import { routePathSegmentSchema } from '@/lib/validation/common';

const adaptiveSubjectIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[\p{L}\p{N}\p{M}_ .,:;()\-\/+&']+$/u);

export const adaptivePipelineProcessRequestSchema = z.strictObject({
  s3Key: z.string().min(1),
  filename: z.string().min(1),
  subject_id: adaptiveSubjectIdSchema.optional(),
  page_batch_size: z.number().int().min(1).max(50).default(10),
});

export type AdaptivePipelineProcessRequestDto = z.infer<
  typeof adaptivePipelineProcessRequestSchema
>;

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
});

export const adaptivePipelineJobRouteParamsSchema = z.strictObject({
  jobId: routePathSegmentSchema,
});
