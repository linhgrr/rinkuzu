import type { QuizQuestion } from '@/entities/Quiz';

export type QuizAttemptAnswer = number | number[];

export interface WrongQuizAttemptQuestion {
  index: number;
  questionId: string;
  question: QuizQuestion;
  userAnswer: QuizAttemptAnswer;
}

export interface RecordQuizAttemptProgressData {
  userId: string;
  quizSlug: string;
  totalQuestions: number;
  correctAnswers: number;
  wrongQuestions: WrongQuizAttemptQuestion[];
}

export interface IQuizAttemptProgressRepository {
  recordSubmittedAttempt(data: RecordQuizAttemptProgressData): Promise<void>;
}
