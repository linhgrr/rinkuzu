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

export interface PersonalLearningSubjectViewModel {
  jobId: string;
  userId: string | null;
  /** Resolved account label, or null when the account is gone / unreadable. */
  displayName: string | null;
  email: string | null;
  filename: string;
  subjectId: string;
  pipelineStatus: string;
  progressStatus: string | null;
  safeErrorCode: string | null;
  retryable: boolean;
  partialSuccess: boolean;
  conceptsExtracted: number;
  conceptsAfterMerge: number;
  relationsAccepted: number;
  totalAnswers: number;
  totalCorrect: number;
  accuracy: number;
  averageMastery: number;
  progressPercent: number;
  masteredConcepts: number;
  lastSessionId: string | null;
  durationSeconds: number | null;
  createdAt: string;
  completedAt: string | null;
  lastActivityAt: string | null;
}

export interface PersonalLearningSubjectsViewModel {
  subjects: PersonalLearningSubjectViewModel[];
  nextCursor: string | null;
}

export interface PersonalLearningSubjectsFilters {
  window: PersonalLearningWindow;
  search?: string;
  pipelineStatus?: string;
  progressStatus?: string;
  cursor?: string;
  limit?: number;
}
