import type { QuizPreviewQuestionViewModel } from '@/features/quiz/types/quiz-preview-view-model';

export type AdminQuizVisibilityViewModel = 'all' | 'public' | 'personal';

export interface AdminQuizAuthorViewModel {
  id: string;
  email?: string;
  name?: string;
  displayName?: string;
  avatar?: string;
}

export interface AdminQuizListItemViewModel {
  id: string;
  title: string;
  description?: string;
  slug: string;
  author: AdminQuizAuthorViewModel;
  folder?: string | null;
  visibility: 'public' | 'personal';
  visibilityLabelKey: 'public' | 'personal';
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminQuizDetailViewModel extends AdminQuizListItemViewModel {
  questions: QuizPreviewQuestionViewModel[];
  pdfUrl?: string;
  tags?: string[];
}

export interface AdminQuizzesPaginationViewModel {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface AdminQuizListViewModel {
  quizzes: AdminQuizListItemViewModel[];
  pagination: AdminQuizzesPaginationViewModel;
}

export interface AdminQuizListQueryInput {
  page: number;
  limit: number;
  search: string;
  visibility: AdminQuizVisibilityViewModel;
  signal: AbortSignal;
}
