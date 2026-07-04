import { z } from 'zod';
import { routePathSegmentSchema } from '@/lib/validation/common';

const adaptiveSubjectIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[\p{L}\p{N}\p{M}_ .,:;()\-\/+&']+$/u);

export const adaptivePipelineProcessRequestSchema = z
  .object({
    s3Key: z.string().min(1),
    filename: z.string().min(1),
    subject_id: adaptiveSubjectIdSchema.optional(),
    page_batch_size: z.number().int().min(1).max(50).default(10),
  })
  .strict();

export type AdaptivePipelineProcessRequestDto = z.infer<
  typeof adaptivePipelineProcessRequestSchema
>;

export const adaptivePipelineJobsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const adaptivePipelineSessionCreateQuerySchema = z
  .object({
    max_steps: z.coerce.number().int().min(5).max(10_000).default(9999),
  })
  .strict();

export const adaptivePipelineJobRouteParamsSchema = z
  .object({
    jobId: routePathSegmentSchema,
  })
  .strict();
