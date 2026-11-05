import type { QuizQuestion } from '@/entities/Quiz';

export type AttemptAnswer = number | number[];

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
  /** Set on a retry-missed attempt: `answers[i]` answers quiz question `questionIndices[i]`. */
  questionIndices?: number[];
}
