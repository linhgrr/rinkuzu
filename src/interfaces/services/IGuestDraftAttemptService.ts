import type { GuestDraftPlayDto } from '@/dtos/guest-draft';
import type { QuizAttemptResultDto } from '@/dtos/quiz';
import type { QuizAttemptAnswer } from '@/entities/QuizAttempt';
import type { ServiceResult } from '@/interfaces/services/types';

/** Stored questions `from` (0-based) to `from + count - 1` (RIN-1619). */
interface GuestDraftQuestionRange {
  from: number;
  count: number;
}

export interface GuestDraftAttemptInput {
  /** The guest draft token (identifies the draft). */
  token: string;
  /** A fresh RIN-912 claim token for this attempt; only its hash is stored. */
  guestClaimToken: string;
  answers: QuizAttemptAnswer[];
  idempotencyKey: string;
  /**
   * The stored questions this round showed (RIN-1619); `from + count` must not pass the
   * stored count. Omitted: the first `answers.length` questions, so a round played on the
   * first batch is scored on it even after the rest arrived.
   */
  questionRange?: GuestDraftQuestionRange | undefined;
}

export interface IGuestDraftAttemptService {
  play(token: string): Promise<ServiceResult<GuestDraftPlayDto>>;
  submit(input: GuestDraftAttemptInput): Promise<ServiceResult<QuizAttemptResultDto>>;
}
