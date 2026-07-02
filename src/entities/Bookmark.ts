export interface BookmarkQuestion {
  text: string;
  options: string[];
  type: 'single' | 'multiple';
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
