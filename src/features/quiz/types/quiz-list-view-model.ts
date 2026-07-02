export interface QuizAuthorViewModel {
  id: string;
  email?: string;
  name?: string;
  displayName?: string;
  avatar?: string;
}

export interface QuizListItemViewModel {
  id: string;
  title: string;
  description?: string;
  slug: string;
  author: QuizAuthorViewModel | null;
  folderId: string | null;
  isPrivate: boolean;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuizListPaginationViewModel {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface QuizListViewModel {
  quizzes: QuizListItemViewModel[];
  pagination: QuizListPaginationViewModel;
}
