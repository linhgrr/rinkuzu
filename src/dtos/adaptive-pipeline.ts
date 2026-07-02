import { z } from 'zod';
import { routePathSegmentSchema } from '@/lib/validation/common';

export const adaptivePipelineProcessRequestSchema = z
  .object({
    s3Key: z.string().min(1),
    filename: z.string().min(1),
    subject_id: z.string().min(1).optional(),
    page_batch_size: z.number().int().min(1).optional(),
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

export const adaptivePipelineJobRouteParamsSchema = z
  .object({
    jobId: routePathSegmentSchema,
  })
  .strict();
