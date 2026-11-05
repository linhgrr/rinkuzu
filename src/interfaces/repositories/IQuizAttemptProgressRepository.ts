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
  questionIndices?: number[];
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
