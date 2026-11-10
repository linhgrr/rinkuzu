import { z } from 'zod';

import { guestClaimTokenSchema } from '@/lib/validation/guest-claim-token';
import { GUEST_DRAFT_ENTRIES } from '@/shared/constants/guest-draft';

/** Text fields of the multipart `POST /api/guest-drafts`; the token comes in a header. */
export const createGuestDraftFieldsSchema = z.object({
  token: guestClaimTokenSchema,
  locale: z.enum(['vi', 'en']),
  entry: z.enum(GUEST_DRAFT_ENTRIES),
});

/** `POST /api/guest-drafts/status`: the token travels in the body, never in the URL. */
export const guestDraftStatusRequestSchema = z.object({ token: guestClaimTokenSchema }).strict();

export interface GuestDraftStatusDto {
  status: 'processing' | 'ready' | 'failed';
  progressPercent: number;
  title: string | null;
  questionCount: number;
  failureReason: string | null;
}

/** Guest drafts a signed-in learner claims (RIN-1447); the browser keeps at most 5. */
const GUEST_DRAFT_CLAIM_MAX_TOKENS = 10;

export const claimGuestDraftsRequestSchema = z
  .object({ tokens: z.array(guestClaimTokenSchema).min(1).max(GUEST_DRAFT_CLAIM_MAX_TOKENS) })
  .strict();

/** Slugs of the quizzes now in the learner's account; never which token failed. */
export interface ClaimGuestDraftsResponseDto {
  claimedQuizSlugs: string[];
}
