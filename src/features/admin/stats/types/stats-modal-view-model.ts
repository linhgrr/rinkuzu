export interface StatsModalPaginationViewModel {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface StatsModalCreatorItemViewModel {
  id: string;
  email: string;
  quizCount: number;
  totalQuestions: number;
  joinedAt: string;
  joinedAtLabel: string;
  role: 'admin' | 'user';
}

interface StatsModalRecentUserViewModel {
  email: string;
  createdAt: string;
}

interface StatsModalRecentQuizViewModel {
  title: string;
  createdAt: string;
  author: {
    id: string;
    email?: string;
    name?: string;
    displayName?: string;
    avatar?: string;
  };
  questionCount: number;
}

interface StatsModalRecentAttemptViewModel {
  id: string;
  score: number;
  takenAt: string;
  answeredQuestions: number;
  actor: {
    email: string;
    type: 'user' | 'guest';
  };
  quiz: {
    title: string;
  };
}

export type StatsModalActivityItemViewModel =
  | {
      id: string;
      type: 'user';
      date: string;
      dateLabel: string;
      data: StatsModalRecentUserViewModel;
    }
  | {
      id: string;
      type: 'quiz';
      date: string;
      dateLabel: string;
      data: StatsModalRecentQuizViewModel;
    }
  | {
      id: string;
      type: 'attempt';
      date: string;
      dateLabel: string;
      data: StatsModalRecentAttemptViewModel;
    };

export type StatsModalItemViewModel =
  | StatsModalCreatorItemViewModel
  | StatsModalActivityItemViewModel;

export interface StatsModalResultViewModel {
  items: StatsModalItemViewModel[];
  pagination: StatsModalPaginationViewModel;
}

export interface FetchStatsModalInput {
  type: 'creators' | 'activity';
  apiEndpoint: string;
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
}
