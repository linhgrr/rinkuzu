import type { QuizProgress } from '@/entities/QuizProgress';

export interface QuizProgressUpsertData {
  questionOrder: number[];
  optionOrders: number[][];
  userAnswers: (number | number[])[];
  currentQuestionIndex: number;
  answeredCount: number;
  totalQuestions: number;
}

export interface IQuizProgressRepository {
  upsert(userId: string, quizId: string, data: QuizProgressUpsertData): Promise<QuizProgress>;

  findByUserAndQuiz(userId: string, quizId: string): Promise<QuizProgress | null>;

  deleteByUserAndQuiz(userId: string, quizId: string): Promise<boolean>;
}
