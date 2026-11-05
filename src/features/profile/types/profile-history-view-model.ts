export interface ProfileHistoryPaginationViewModel {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ProfileHistoryAttemptViewModel {
  id: string;
  score: number;
  takenAt: string;
  takenAtLabel: string;
  totalQuestions: number;
  /** Quick round only (RIN-936). */
  mode?: 'quick';
  quiz: {
    title: string;
    slug: string;
    description?: string;
  };
}

export interface ProfileHistoryViewModel {
  attempts: ProfileHistoryAttemptViewModel[];
  pagination: ProfileHistoryPaginationViewModel;
}
