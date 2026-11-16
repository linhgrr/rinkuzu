import type { QuizAnswer } from '@/features/quiz/types/quiz-interaction-view-model';
import type { GuestDraftCompletion, GuestDraftStatus } from '@/shared/constants/guest-draft';

/** Progress of a guest draft as the upload page shows it (RIN-1448). */
export interface GuestDraftProgress {
  status: GuestDraftStatus;
  /** 0-100. */
  percent: number;
  questionCount: number;
  title: string | null;
  /**
   * False while a ready draft holds only its first batch and more may come (RIN-1619);
   * absent on answers that predate it.
   */
  complete?: boolean;
  /** `first_batch_only` when the rest never came (RIN-1619); null or absent otherwise. */
  completion?: GuestDraftCompletion | null;
}

/**
 * What the page shows when the browser or the server refuses a PDF, a Word or PowerPoint
 * file or a pasted text. `too_large` is a PDF over the limits or a text over the trial
 * length (RIN-1539); the last five are the office-file refusals (RIN-1786).
 */
export type GuestDraftRefusal =
  | 'too_large'
  | 'too_short'
  | 'not_pdf'
  | 'cap'
  | 'upload_error'
  | 'office_too_large'
  | 'legacy_format'
  | 'encrypted'
  | 'corrupt'
  | 'too_little_text'
  | 'service_unavailable';

/** One submit of a guest-draft attempt (RIN-1448); the draft token is passed beside it. */
export interface GuestDraftAttemptInput {
  answers: QuizAnswer[];
  idempotencyKey: string;
  /** A fresh RIN-912 claim token for this attempt; only its hash is stored. */
  guestClaimToken: string;
  /** The draft questions this round showed; omitted: the first `answers.length` (RIN-1619). */
  questionRange?: { from: number; count: number };
}

export interface SubmittedGuestDraftAttempt {
  attemptId: string;
  score: number;
}
