import type {
  AdminQuizDetailViewModel,
  AdminQuizFlagFilterViewModel,
  AdminQuizListItemViewModel,
  AdminQuizzesPaginationViewModel,
  AdminQuizVisibilityViewModel,
} from '@/features/admin/quizzes/types/admin-quizzes-view-model';

/** The row after an admin Clear flag (RIN-1342): no badge, no Clear flag button. */
function withoutPersonalDataFlag(quiz: AdminQuizListItemViewModel): AdminQuizListItemViewModel {
  const { personalDataKinds: _cleared, ...rest } = quiz;
  return rest;
}

export interface AdminQuizzesPageState {
  quizzes: AdminQuizListItemViewModel[];
  pagination: AdminQuizzesPaginationViewModel;
  loading: boolean;
  error: string;
  /**
   * A failed list load: replaces the filters, the stats and the list with ErrorState and Retry
   * (RIN-1022). Kept while a retry runs, so Retry stays pending with no skeleton flash (RIN-1166).
   */
  loadError: unknown;
  reloadToken: number;
  searchInput: string;
  appliedSearch: string;
  visibility: AdminQuizVisibilityViewModel;
  flag: AdminQuizFlagFilterViewModel;
  page: number;
  previewQuiz: AdminQuizDetailViewModel | null;
  previewingQuizId: string | null;
  quizToDelete: AdminQuizListItemViewModel | null;
  deletingQuizId: string | null;
  quizToToggle: AdminQuizListItemViewModel | null;
  togglingQuizId: string | null;
}

export type AdminQuizzesPageAction =
  | { type: 'patch'; value: Partial<AdminQuizzesPageState> }
  | {
      type: 'loaded';
      quizzes: AdminQuizListItemViewModel[];
      pagination: AdminQuizzesPaginationViewModel;
    }
  | { type: 'removed'; quizId: string }
  | { type: 'flagCleared'; quizId: string }
  | { type: 'visibilityChanged'; quizId: string; visibility: 'public' | 'personal' };

export const initialAdminQuizzesPageState: AdminQuizzesPageState = {
  quizzes: [],
  pagination: {
    page: 1,
    totalPages: 0,
    total: 0,
    limit: 12,
    hasNextPage: false,
    hasPrevPage: false,
  },
  loading: true,
  error: '',
  loadError: null,
  reloadToken: 0,
  searchInput: '',
  appliedSearch: '',
  visibility: 'all',
  flag: 'all',
  page: 1,
  previewQuiz: null,
  previewingQuizId: null,
  quizToDelete: null,
  deletingQuizId: null,
  quizToToggle: null,
  togglingQuizId: null,
};

export function adminQuizzesPageReducer(
  state: AdminQuizzesPageState,
  action: AdminQuizzesPageAction,
): AdminQuizzesPageState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.value };
    case 'loaded':
      return {
        ...state,
        quizzes: action.quizzes,
        pagination: action.pagination,
        loading: false,
        error: '',
        loadError: null,
      };
    case 'removed':
      return {
        ...state,
        quizzes: state.quizzes.filter((quiz) => quiz.id !== action.quizId),
        quizToDelete: null,
        deletingQuizId: null,
        pagination: {
          ...state.pagination,
          total: Math.max(0, state.pagination.total - 1),
        },
      };
    case 'flagCleared':
      return {
        ...state,
        quizzes: state.quizzes.map((quiz) =>
          quiz.id === action.quizId ? withoutPersonalDataFlag(quiz) : quiz,
        ),
      };
    case 'visibilityChanged':
      return {
        ...state,
        quizzes: state.quizzes.map((quiz) =>
          quiz.id === action.quizId
            ? { ...quiz, visibility: action.visibility, visibilityLabelKey: action.visibility }
            : quiz,
        ),
        quizToToggle: null,
        togglingQuizId: null,
      };
    default:
      return state;
  }
}
