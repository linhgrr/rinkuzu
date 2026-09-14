import { z } from 'zod';

/** Windows the adaptive analytics endpoints accept, mirrored from the backend. */
const personalLearningWindowSchema = z.enum(['7d', '30d', '90d', 'all']);

export const personalLearningSummaryQuerySchema = z
  .object({
    window: personalLearningWindowSchema.default('30d'),
  })
  .strict();

export const personalLearningSubjectsQuerySchema = z
  .object({
    window: personalLearningWindowSchema.default('30d'),
    search: z.string().trim().min(1).max(128).optional(),
    pipeline_status: z.string().trim().min(1).max(64).optional(),
    progress_status: z.string().trim().min(1).max(64).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().trim().min(1).max(512).optional(),
  })
  .strict();

/** Admin-inclusive identity used only to label analytics rows keyed by user id. */
export interface AdminUserIdentityDto {
  id: string;
  email: string;
  displayName?: string;
}
