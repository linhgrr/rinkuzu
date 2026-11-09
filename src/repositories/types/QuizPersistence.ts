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
  slugAliases?: string[];
  author: MongoIdLike | QuizAuthorPersistenceRecord;
  folder?: MongoIdLike | null;
  questions: QuizQuestionPersistenceRecord[];
  visibility: 'public' | 'personal';
  pdfUrl?: string;
  tags?: string[];
  sourceDraftId?: string;
  questionCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Owner fields read only to decide quiz indexing (RIN-840). */
interface QuizOwnerIndexingPersistenceRecord {
  email?: string | null;
  isTestAccount?: boolean | null;
}

export interface QuizMetadataPersistenceRecord extends QuizPersistenceRecord {
  ownerIndexing?: QuizOwnerIndexingPersistenceRecord;
  /** Texts of the first questions (RIN-1241); entries may be missing in old data. */
  leadQuestionTexts?: unknown[];
}
