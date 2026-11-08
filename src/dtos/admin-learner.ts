import { z } from 'zod';

export const adminLearnerSearchQuerySchema = z.object({
  search: z.string().trim().min(2).max(100),
});

/** Allowlisted learner identity: nothing beyond what picking a learner needs. */
export interface AdminLearnerIdentityDto {
  id: string;
  displayName: string | null;
  email: string;
}

export interface AdminLearnerSearchDto {
  learners: AdminLearnerIdentityDto[];
}
