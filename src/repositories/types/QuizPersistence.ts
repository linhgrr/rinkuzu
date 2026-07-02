import type { MongoIdLike } from '@/types/mongo';

interface QuizQuestionPersistenceBase {
  _id: MongoIdLike;
  question: string;
  options: string[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

export type QuizQuestionPersistenceRecord =
  | (QuizQuestionPersistenceBase & {
      type: 'single';
      correctIndex: number;
      correctIndexes?: never;
    })
  | (QuizQuestionPersistenceBase & {
      type: 'multiple';
      correctIndex?: never;
      correctIndexes: number[];
    });

export interface QuizAuthorPersistenceRecord {
  _id: MongoIdLike;
  email?: string;
  name?: string;
  displayName?: string;
  avatar?: string;
}

export interface QuizPersistenceRecord {
  _id: MongoIdLike;
  title: string;
  description?: string;
  slug: string;
  author: MongoIdLike | QuizAuthorPersistenceRecord;
  folder?: MongoIdLike | null;
  questions: QuizQuestionPersistenceRecord[];
  isPrivate: boolean;
  pdfUrl?: string;
  tags?: string[];
  sourceDraftId?: string;
  questionCount?: number;
  createdAt: Date;
  updatedAt: Date;
}
