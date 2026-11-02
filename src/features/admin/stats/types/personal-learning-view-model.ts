export type PersonalLearningWindow = '7d' | '30d' | '90d' | 'all';

export interface PersonalLearningBreakdownRowViewModel {
  key: string;
  count: number;
}

export interface PersonalLearningTrendPointViewModel {
  period: string;
  jobsCreated: number;
  jobsCompleted: number;
  jobsFailed: number;
  activeLearners: number;
  answers: number;
  correctAnswers: number;
}

export interface PersonalLearningSummaryViewModel {
  window: PersonalLearningWindow;
  bucket: 'day' | 'month';
  adoption: {
    activeLearners: number;
    subjectsCreated: number;
    subjectsCompleted: number;
    subjectsWithProgress: number;
  };
  outcomes: {
    totalAnswers: number;
    totalCorrect: number;
    weightedAccuracy: number;
    averageMastery: number;
    averageProgress: number;
    masteredConcepts: number;
  };
  pipeline: {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    cancelledJobs: number;
    activeJobs: number;
    partialSuccesses: number;
    retryableFailures: number;
    successRate: number;
    failureRate: number;
    averageDurationSeconds: number;
  };
  pipelineStatuses: PersonalLearningBreakdownRowViewModel[];
  progressStatuses: PersonalLearningBreakdownRowViewModel[];
  topErrorCodes: PersonalLearningBreakdownRowViewModel[];
  trend: PersonalLearningTrendPointViewModel[];
}
