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
