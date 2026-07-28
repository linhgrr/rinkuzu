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

export type AdminGrowthPeriodViewModel = 7 | 30 | 90 | 365;

interface AdminGrowthDataPointViewModel {
  date: string;
  newUsers: number;
  newQuizzes: number;
  attempts: number;
  averageScore: number | null;
}

export interface AdminMetricComparisonViewModel {
  current: number;
  previous: number;
  changePercent: number | null;
}

export interface AdminGrowthTrendsViewModel {
  period: AdminGrowthPeriodViewModel;
  from: string;
  to: string;
  data: AdminGrowthDataPointViewModel[];
  comparison: {
    newUsers: AdminMetricComparisonViewModel;
    newQuizzes: AdminMetricComparisonViewModel;
    attempts: AdminMetricComparisonViewModel;
    averageScore: AdminMetricComparisonViewModel;
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
    passRate: number;
    scoreDistribution: {
      range: string;
      min: number;
      max: number;
      count: number;
      passing: boolean;
    }[];
  };
  growthTrends: AdminGrowthTrendsViewModel;
}
