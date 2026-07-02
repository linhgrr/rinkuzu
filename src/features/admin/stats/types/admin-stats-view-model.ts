export interface AdminOverviewStatsViewModel {
  totalQuizzes: number;
  totalUsers: number;
  totalAdmins: number;
  totalAttempts: number;
}

export interface AdminTimeBucketViewModel {
  newUsers: number;
  newQuizzes: number;
  attempts: number;
}

export interface AdminRecentUserViewModel {
  email: string;
  createdAt: string;
  createdAtLabel: string;
}

export interface AdminRecentQuizViewModel {
  title: string;
  createdAt: string;
  createdAtLabel: string;
  questionCount: number;
}

export interface AdminRecentAttemptViewModel {
  id: string;
  score: number;
  takenAt: string;
  takenAtLabel: string;
  answeredQuestions: number;
  actor: {
    email: string;
    type: 'user' | 'guest';
  };
  quiz: {
    title: string;
  };
}

export interface AdminCreatorStatsViewModel {
  id: string;
  email: string;
  quizCount: number;
  totalQuestions: number;
  joinedAt: string;
  role: 'admin' | 'user';
  successRate: number;
}

export interface AdminStatsViewModel {
  overview: AdminOverviewStatsViewModel;
  timeBasedStats: {
    today: AdminTimeBucketViewModel;
    thisWeek: AdminTimeBucketViewModel;
    thisMonth: AdminTimeBucketViewModel;
  };
  recentActivity: {
    users: AdminRecentUserViewModel[];
    quizzes: AdminRecentQuizViewModel[];
    attempts: AdminRecentAttemptViewModel[];
  };
  topCreators: AdminCreatorStatsViewModel[];
  scoreStats: {
    averageScore: number;
    highestScore: number;
    lowestScore: number;
  };
}
