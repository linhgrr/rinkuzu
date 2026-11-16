import { z } from 'zod';

import { quizProgressAnswerSchema, type PlayableQuizQuestionDto } from '@/dtos/quiz';
import { quizTextSchema } from '@/dtos/quiz-text-source';
import { guestClaimTokenSchema } from '@/lib/validation/guest-claim-token';
import {
  GUEST_DRAFT_ENTRIES,
  GUEST_DRAFT_FILE_TYPES,
  GUEST_DRAFT_OFFICE_SURFACES,
  type GuestDraftCompletion,
} from '@/shared/constants/guest-draft';

/** Text fields of the multipart `POST /api/guest-drafts`; the token comes in a header. */
export const createGuestDraftFieldsSchema = z.object({
  token: guestClaimTokenSchema,
  locale: z.enum(['vi', 'en']),
  entry: z.enum(GUEST_DRAFT_ENTRIES),
});

/**
 * JSON body of `POST /api/guest-drafts/text` (RIN-1538) plus the header token. The text
 * goes to the API and nowhere else: never logged, stored here or sent to analytics.
 * `source_file_type` is set when the browser extracted the text from a .docx or .pptx
 * (RIN-1786); `upload_surface` says which page that was, for the daily office counter.
 */
export const createGuestTextDraftRequestSchema = createGuestDraftFieldsSchema
  .extend({
    text: quizTextSchema,
    source_file_type: z.enum(GUEST_DRAFT_FILE_TYPES).optional(),
    upload_surface: z.enum(GUEST_DRAFT_OFFICE_SURFACES).optional(),
  })
  .strict();

/**
 * `POST /api/guest-drafts/status` and `/play`: the token travels in the body, never in
 * the URL.
 */
export const guestDraftTokenRequestSchema = z.object({ token: guestClaimTokenSchema }).strict();

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
    /**
     * The questions this round showed (RIN-1619), e.g. `{ from: 5, count: 5 }` for "Keep
     * going" on the rest. Omitted: the first `answers.length` questions.
     */
    questionRange: z
      .object({ from: z.number().int().min(0), count: z.number().int().min(1).max(100) })
      .strict()
      .optional(),
  })
  .strict();

/** A ready guest draft to play: no correct answers leave the server. */
export interface GuestDraftPlayDto {
  title: string;
  questions: PlayableQuizQuestionDto[];
  /** False while only the first batch is stored and more may come (RIN-1619). */
  complete: boolean;
  /** `first_batch_only` when the rest failed; null while incomplete. */
  completion: GuestDraftCompletion | null;
}

export interface GuestDraftStatusDto {
  status: 'processing' | 'ready' | 'failed';
  progressPercent: number;
  title: string | null;
  questionCount: number;
  /** False while a ready draft holds only its first batch: keep polling (RIN-1619). */
  complete: boolean;
  /** `first_batch_only` when the rest failed; null until complete. */
  completion: GuestDraftCompletion | null;
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
