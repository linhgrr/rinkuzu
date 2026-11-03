export interface AdminStatsDailyCountRecord {
  date: string;
  count: number;
}

export interface AdminStatsDailyAttemptRecord extends AdminStatsDailyCountRecord {
  scoreTotal: number;
  scoredAttempts: number;
}

export interface AdminStatsDailyActivity {
  users: AdminStatsDailyCountRecord[];
  quizzes: AdminStatsDailyCountRecord[];
  attempts: AdminStatsDailyAttemptRecord[];
}

export interface AdminStatsScoreBucket {
  range: string;
  min: number;
  max: number;
  count: number;
  passing: boolean;
}

/** Which path activated a learner; `quiz + adaptive + both` is the learner count. */
export interface AdminActivationPathCounts {
  quiz: number;
  adaptive: number;
  both: number;
}

/** Per-signup-week cohort counts; `weekStart` is Monday 00:00 UTC. */
interface AdminActivationCohortRecord {
  weekStart: Date;
  signups: number;
  material: number;
  activated: number;
  activatedBy: AdminActivationPathCounts;
  w1Retained: number;
}

/**
 * Learners whose first ever completion (quiz attempt or adaptive completion,
 * whichever came first) falls in the week starting `weekStart`.
 */
interface AdminFirstAttemptWeekRecord {
  weekStart: Date;
  learners: number;
  activatedBy: AdminActivationPathCounts;
}

/**
 * One learner's Path B (adaptive) events, as served by the API's
 * `GET /admin/activation/adaptive-events`. `userId` is the web user id (hex);
 * `firstCompletionAt` is all-time, the two lists are within the fetched window.
 */
export interface AdminAdaptiveLearnerEvents {
  userId: string;
  firstCompletionAt: Date | null;
  completions: Date[];
  succeededUploads: Date[];
}

export interface AdminActivationAggregates {
  cohorts: AdminActivationCohortRecord[];
  firstAttempts: AdminFirstAttemptWeekRecord[];
}

/**
 * Read-only analytics queries kept separate from domain repositories so adding a
 * dashboard metric does not expand every quiz/user/attempt test double.
 */
export interface IAdminStatsRepository {
  getDailyActivity(since: Date): Promise<AdminStatsDailyActivity>;
  getScoreDistribution(): Promise<AdminStatsScoreBucket[]>;
  /**
   * Aggregates for ISO weeks in `[from, to)`; both bounds are Monday 00:00 UTC.
   * `adaptive` events are merged in, each learner counted once.
   */
  getActivationAggregates(
    from: Date,
    to: Date,
    adaptive?: readonly AdminAdaptiveLearnerEvents[],
  ): Promise<AdminActivationAggregates>;
}
