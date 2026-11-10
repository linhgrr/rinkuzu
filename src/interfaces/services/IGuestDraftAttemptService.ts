import type { PlayableQuizQuestionDto, QuizAttemptResultDto } from '@/dtos/quiz';
import type { QuizAttemptAnswer } from '@/entities/QuizAttempt';
import type { ServiceResult } from '@/interfaces/services/types';

/** A ready guest draft to play: no correct answers leave the server. */
export interface GuestDraftPlayDto {
  title: string;
  questions: PlayableQuizQuestionDto[];
}

export interface GuestDraftAttemptInput {
  /** The guest draft token (identifies the draft). */
  token: string;
  /** A fresh RIN-912 claim token for this attempt; only its hash is stored. */
  guestClaimToken: string;
  answers: QuizAttemptAnswer[];
  idempotencyKey: string;
}

export interface IGuestDraftAttemptService {
  play(token: string): Promise<ServiceResult<GuestDraftPlayDto>>;
  submit(input: GuestDraftAttemptInput): Promise<ServiceResult<QuizAttemptResultDto>>;
}
