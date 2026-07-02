import type { QuizQuestionPersistenceRecord } from '@/repositories/types/QuizPersistence';
import type { SelectedAnswerPersistenceRecord } from '@/repositories/types/AnswerPersistence';
import type { MongoIdLike } from '@/types/mongo';

export interface AttemptUserPersistenceRecord {
  _id: MongoIdLike;
  email: string;
}

export interface AttemptQuizPersistenceRecord {
  _id: MongoIdLike;
  title: string;
  slug: string;
  description?: string;
  questions?: QuizQuestionPersistenceRecord[];
}

export interface AttemptPersistenceRecord {
  _id: MongoIdLike;
  user?: MongoIdLike | AttemptUserPersistenceRecord | null;
  guestEmail?: string;
  quiz: MongoIdLike | AttemptQuizPersistenceRecord;
  answers: SelectedAnswerPersistenceRecord[];
  score: number;
  totalQuestions: number;
  takenAt: Date;
}
