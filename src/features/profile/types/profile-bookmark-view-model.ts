import type { QuestionType } from '@/shared/constants/question-type';

interface ProfileBookmarkQuestionViewModel {
  text: string;
  options: string[];
  type: QuestionType;
  correctIndex?: number;
  correctIndexes?: number[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

export interface ProfileBookmarkViewModel {
  id: string;
  quiz: {
    slug: string;
    title: string;
    description?: string;
  };
  question: ProfileBookmarkQuestionViewModel;
  questionIndex: number;
  createdAt: string;
  createdAtLabel: string;
  updatedAt?: string;
  updatedAtLabel?: string;
}

interface ProfileBookmarkPaginationViewModel {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ProfileBookmarkListViewModel {
  bookmarks: ProfileBookmarkViewModel[];
  pagination: ProfileBookmarkPaginationViewModel;
}

interface ProfileBookmarkQuizViewModel {
  slug: string;
  title: string;
  count: number;
}

/** The quizzes the learner has bookmarks in, most bookmarks first (RIN-1208). */
export interface ProfileBookmarkQuizListViewModel {
  quizzes: ProfileBookmarkQuizViewModel[];
  /** Every bookmark the learner has, across all quizzes. */
  total: number;
}
