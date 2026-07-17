interface QuizProgressQuizSnapshot {
  id: string;
  title?: string;
  slug?: string;
}

export interface QuizProgress {
  id: string;
  userId: string;
  quiz: string | QuizProgressQuizSnapshot;
  questionOrder: number[];
  optionOrders: number[][];
  userAnswers: (number | number[])[];
  currentQuestionIndex: number;
  answeredCount: number;
  totalQuestions: number;
  updatedAt: Date;
}
