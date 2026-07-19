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
