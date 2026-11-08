import type { AttemptAnswer } from '@/entities/Attempt';
import type { QuizQuestion } from '@/entities/Quiz';
import type { WrongQuizAttemptQuestion } from '@/entities/QuizAttempt';

interface AttemptQuizSnapshotData {
  integrity: 'complete';
  title: string;
  slug: string;
  description?: string;
  questions: QuizQuestion[];
}

interface QuizAttemptSubmissionData {
  idempotencyKey: string;
  quizId: string;
  quizSlug: string;
  quizSnapshot: AttemptQuizSnapshotData;
  answers: AttemptAnswer[];
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  wrongQuestions: WrongQuizAttemptQuestion[];
  takenAt: Date;
  premiumSubmissionId?: string;
  premiumSnapshotHash?: string;
  /** Retry-missed attempt: the source attempt and the quiz question index of each answer. */
  retryOfAttemptId?: string;
  /** Retry (ascending) or quick round (play order): the quiz question index of each answer. */
  questionIndices?: number[];
  /** Quick round (RIN-936); absent on full and retry attempts. */
  mode?: 'quick';
}

export type RecordQuizAttemptProgressData =
  | (QuizAttemptSubmissionData & {
      userId: string;
      guestEmail?: never;
      guestClaimTokenHash?: never;
    })
  | (QuizAttemptSubmissionData & {
      userId?: never;
      guestEmail: string;
      guestClaimTokenHash?: never;
    })
  | (QuizAttemptSubmissionData & {
      userId?: never;
      guestEmail?: never;
      /** SHA-256 hex of the guest claim token; never log it. */
      guestClaimTokenHash: string;
    });

export interface RecordedQuizAttempt {
  id: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
}

export interface IQuizAttemptProgressRepository {
  recordSubmittedAttempt(data: RecordQuizAttemptProgressData): Promise<RecordedQuizAttempt>;
}

export interface IGuestAttemptClaimRepository {
  /**
   * Attaches each unclaimed, token-identified guest attempt taken since
   * `claimableSince` to `userId` (single use: the hash is removed) and applies
   * the user progress a signed-in submit would have written. Returns the ids
   * claimed; hashes that match nothing are dropped.
   */
  claimGuestAttempts(
    userId: string,
    tokenHashes: readonly string[],
    now: Date,
    claimableSince: Date,
  ): Promise<string[]>;
}
