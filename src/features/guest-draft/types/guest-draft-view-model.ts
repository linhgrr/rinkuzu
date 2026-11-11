import type { QuizAnswer } from '@/features/quiz/types/quiz-interaction-view-model';
import type { GuestDraftStatus } from '@/shared/constants/guest-draft';

/** Progress of a guest draft as the upload page shows it (RIN-1448). */
export interface GuestDraftProgress {
  status: GuestDraftStatus;
  /** 0-100. */
  percent: number;
  questionCount: number;
  title: string | null;
}

/**
 * What the page shows when the browser or the server refuses a PDF or a pasted text.
 * `too_large` is a PDF over the limits or a text over the trial length (RIN-1539).
 */
export type GuestDraftRefusal = 'too_large' | 'too_short' | 'not_pdf' | 'cap' | 'upload_error';

/** One submit of a guest-draft attempt (RIN-1448); the draft token is passed beside it. */
export interface GuestDraftAttemptInput {
  answers: QuizAnswer[];
  idempotencyKey: string;
  /** A fresh RIN-912 claim token for this attempt; only its hash is stored. */
  guestClaimToken: string;
}

export interface SubmittedGuestDraftAttempt {
  attemptId: string;
  score: number;
}
