import type { MongoIdLike } from '@/types/mongo';
import type { QuestionType } from '@/shared/constants/question-type';

interface BookmarkQuestionPersistenceRecord {
  text: string;
  options: string[];
  type: QuestionType;
  correctIndex?: number;
  correctIndexes?: number[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

interface BookmarkQuizPersistenceRecord {
  slug: string;
  title: string;
  description?: string;
}

export interface BookmarkPersistenceRecord {
  _id: MongoIdLike;
  userId: string;
  userEmail: string;
  quiz: BookmarkQuizPersistenceRecord;
  question: BookmarkQuestionPersistenceRecord;
  questionIndex: number;
  createdAt: Date;
  updatedAt: Date;
}
