import type { QuizPreviewQuestionViewModel } from '@/features/quiz/types/quiz-preview-view-model';

export type AdminQuizVisibilityViewModel = 'all' | 'public' | 'private';

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
  isPrivate: boolean;
  visibilityLabelKey: 'private' | 'public';
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
