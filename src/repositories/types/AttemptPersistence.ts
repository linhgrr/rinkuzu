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

interface EmbeddedAttemptQuizSnapshotPersistenceRecord {
  integrity: 'complete';
  title: string;
  slug: string;
  description?: string;
  questions: QuizQuestionPersistenceRecord[];
}

export interface AttemptPersistenceRecord {
  _id: MongoIdLike;
  user?: MongoIdLike | AttemptUserPersistenceRecord | null;
  guestEmail?: string;
  quiz: MongoIdLike | AttemptQuizPersistenceRecord;
  /** Present on stored attempts; read pipelines project it into `quiz`. */
  quizSnapshot?: EmbeddedAttemptQuizSnapshotPersistenceRecord;
  answers: SelectedAnswerPersistenceRecord[];
  score: number;
  totalQuestions: number;
  takenAt: Date;
}

export interface RecentAttemptActivityPersistenceRecord {
  _id: MongoIdLike;
  userEmail?: string;
  guestEmail?: string;
  quizTitle?: string;
  score: number;
  answeredQuestions: number;
  takenAt: Date;
}
