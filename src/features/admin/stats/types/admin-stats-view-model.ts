interface AdminOverviewStatsViewModel {
  totalQuizzes: number;
  totalUsers: number;
  totalAdmins: number;
  totalAttempts: number;
}

interface AdminTimeBucketViewModel {
  newUsers: number;
  newQuizzes: number;
  attempts: number;
}

interface AdminRecentUserViewModel {
  email: string;
  createdAt: string;
  createdAtLabel: string;
}

interface AdminRecentQuizViewModel {
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

interface AdminCreatorStatsViewModel {
  id: string;
  email: string;
  quizCount: number;
  totalQuestions: number;
  joinedAt: string;
  role: 'admin' | 'user';
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
