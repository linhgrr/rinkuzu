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
  /** Signed-in legacy field; guests send `guestClaimToken` instead (RIN-912). */
  userEmail?: string;
  guestClaimToken?: string;
}

export interface AddQuizDiscussionCommentInput {
  slug: string;
  questionIndex: number;
  content: string;
}
