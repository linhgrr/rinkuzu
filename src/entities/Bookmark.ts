import type { QuestionType } from '@/shared/constants/question-type';

export interface BookmarkQuestion {
  text: string;
  options: string[];
  type: QuestionType;
  correctIndex?: number;
  correctIndexes?: number[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

export interface BookmarkQuizSummary {
  slug: string;
  title: string;
  description?: string;
}

export interface Bookmark {
  id: string;
  userId: string;
  userEmail: string;
  quiz: BookmarkQuizSummary;
  question: BookmarkQuestion;
  questionIndex: number;
  createdAt: Date;
  updatedAt: Date;
}
