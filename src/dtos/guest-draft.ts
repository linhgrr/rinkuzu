import { z } from 'zod';

import { quizProgressAnswerSchema, type PlayableQuizQuestionDto } from '@/dtos/quiz';
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

/** `POST /api/guest-drafts/play`: the questions of a ready draft, without answers. */
export const guestDraftPlayRequestSchema = guestDraftStatusRequestSchema;

/**
 * `POST /api/guest-drafts/attempt`: `token` names the draft; `guestClaimToken` is a fresh
 * RIN-912 claim token for this attempt (only its hash is stored, claimed on sign-up).
 */
export const guestDraftAttemptRequestSchema = z
  .object({
    token: guestClaimTokenSchema,
    guestClaimToken: guestClaimTokenSchema,
    answers: z.array(quizProgressAnswerSchema).min(1).max(100),
    idempotencyKey: z.uuid(),
  })
  .strict();

/** A ready guest draft to play: no correct answers leave the server. */
export interface GuestDraftPlayDto {
  title: string;
  questions: PlayableQuizQuestionDto[];
}

export interface GuestDraftStatusDto {
  status: 'processing' | 'ready' | 'failed';
  progressPercent: number;
  title: string | null;
  questionCount: number;
  failureReason: string | null;
}
