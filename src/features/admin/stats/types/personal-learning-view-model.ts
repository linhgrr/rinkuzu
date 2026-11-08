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

export interface LearnerIdentityViewModel {
  id: string;
  displayName: string | null;
  email: string;
}

/** Allowlisted per-learner row: no document content, answers or billing data. */
export interface LearnerSubjectViewModel {
  jobId: string;
  filename: string;
  pipelineStatus: string;
  progressStatus: string | null;
  accuracy: number;
  progressPercent: number;
  lastActivityAt: string | null;
}
