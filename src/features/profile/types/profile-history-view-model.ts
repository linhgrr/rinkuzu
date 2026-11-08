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

/** Over all of the learner's attempts, independent of the filter and page (RIN-1204). */
export interface ProfileHistorySummaryViewModel {
  totalAttempts: number;
  /** Rounded percent; `null` with no attempts. */
  averageScore: number | null;
  needsWorkCount: number;
}

export interface ProfileHistoryViewModel {
  attempts: ProfileHistoryAttemptViewModel[];
  pagination: ProfileHistoryPaginationViewModel;
  summary: ProfileHistorySummaryViewModel;
}
