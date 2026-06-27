export interface IQuizProgress {
  _id?: string;
  userId: string;
  quiz:
    | string
    | {
        _id: string;
        title?: string;
        slug?: string;
      };
  questionOrder: number[];
  optionOrders: number[][];
  userAnswers: (number | number[])[];
  currentQuestionIndex: number;
  answeredCount: number;
  totalQuestions: number;
  updatedAt: Date;
}

export interface QuizProgressUpsertData {
  questionOrder: number[];
  optionOrders: number[][];
  userAnswers: (number | number[])[];
  currentQuestionIndex: number;
  answeredCount: number;
  totalQuestions: number;
}

export interface IQuizProgressRepository {
  upsert(userId: string, quizId: string, data: QuizProgressUpsertData): Promise<IQuizProgress>;

  findByUserAndQuiz(userId: string, quizId: string): Promise<IQuizProgress | null>;

  deleteByUserAndQuiz(userId: string, quizId: string): Promise<boolean>;

  findInProgressByUser(userId: string, limit?: number): Promise<IQuizProgress[]>;
}
