import type { QuizQuestion } from '@/entities/Quiz';

export type AttemptAnswer = number | number[];

/** RIN-933: a quick round plays a chosen subset of a long quiz. No `mode` means a full attempt. */
export type AttemptMode = 'quick' | 'full';

export interface AttemptUserPreview {
  id: string;
  email: string;
}

export interface AttemptQuizSnapshot {
  id: string;
  title: string;
  slug: string;
  description?: string;
  questions?: QuizQuestion[];
}

export interface Attempt {
  id: string;
  user: string | AttemptUserPreview | null;
  guestEmail?: string;
  quiz: string | AttemptQuizSnapshot;
  premiumSubmissionId?: string;
  premiumSnapshotHash?: string;
  answers: AttemptAnswer[];
  score: number;
  totalQuestions: number;
  takenAt: Date;
  /** Set on a retry-missed attempt: the attempt whose missed questions were replayed. */
  retryOfAttemptId?: string;
  /**
   * Set on a retry-missed attempt (ascending) and on a quick round (play order):
   * `answers[i]` answers quiz question `questionIndices[i]`.
   */
  questionIndices?: number[];
  /** `quick` on a quick round; absent on full and retry attempts. */
  mode?: AttemptMode;
}
