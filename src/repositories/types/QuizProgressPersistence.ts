import type { SelectedAnswerPersistenceRecord } from '@/repositories/types/AnswerPersistence';
import type { MongoIdLike } from '@/types/mongo';

export interface QuizProgressQuizPersistenceRecord {
  _id: MongoIdLike;
  title?: string;
  slug?: string;
}

export interface QuizProgressPersistenceRecord {
  _id: MongoIdLike;
  userId: MongoIdLike;
  quiz: MongoIdLike | QuizProgressQuizPersistenceRecord;
  questionOrder: number[];
  optionOrders: number[][];
  userAnswers: SelectedAnswerPersistenceRecord[];
  currentQuestionIndex: number;
  answeredCount: number;
  totalQuestions: number;
  updatedAt: Date;
}
