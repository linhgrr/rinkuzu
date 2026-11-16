import type { QuizQuestion } from '@/entities/Quiz';

export type QuizAttemptAnswer = number | number[];

export interface WrongQuizAttemptQuestion {
  questionId: string;
  question: QuizQuestion;
}

export interface QuizAttemptEvaluation {
  answers: QuizAttemptAnswer[];
  correctAnswers: number;
  score: number;
  totalQuestions: number;
  wrongQuestions: WrongQuizAttemptQuestion[];
}

/** A claimed attempt with the hash of the token that claimed it (RIN-1711). Never log either. */
export interface ClaimedGuestAttemptRef {
  attemptId: string;
  tokenHash: string;
}
