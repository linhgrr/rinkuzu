import type { UserIdentity } from '@/components/user/user-identity';

export type QuizAnswer = number | number[];

export interface QuizAttemptResultViewModel {
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  attemptId: string;
}

export interface SavedQuizProgress {
  questionOrder: number[];
  optionOrders: number[][];
  userAnswers: QuizAnswer[];
  currentQuestionIndex: number;
  answeredCount: number;
  totalQuestions: number;
}

export interface QuizDiscussionCommentViewModel {
  id: string;
  author: UserIdentity;
  content: string;
  isEdited: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface QuizDiscussionViewModel {
  id: string;
  questionIndex: number;
  comments: QuizDiscussionCommentViewModel[];
  createdAt: string;
  updatedAt: string;
}

export interface SubmitQuizAttemptInput {
  slug: string;
  answers: QuizAnswer[];
  idempotencyKey: string;
  /** Signed-out learners only (RIN-912); the session identifies everyone else. */
  guestClaimToken?: string;
  /** Retry-missed session: the attempt whose misses are being retried (RIN-917). */
  retryOfAttemptId?: string;
  /** Quick round (RIN-933): `answers[i]` answers quiz question `questionIndices[i]`. */
  questionIndices?: number[];
  /** Tracked entry point (RIN-1242); the API drops anything untracked (RIN-1256). */
  entry?: string;
  /** Blog post slug, only with `entry: 'blog'`. */
  post?: string;
  /** Hub topic slug, only with `entry: 'hub'` (RIN-1417). */
  topic?: string;
}

export interface AddQuizDiscussionCommentInput {
  slug: string;
  questionIndex: number;
  content: string;
}
