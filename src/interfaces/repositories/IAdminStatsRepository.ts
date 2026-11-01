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

/** Per-signup-week cohort counts; `weekStart` is Monday 00:00 UTC. */
export interface AdminActivationCohortRecord {
  weekStart: Date;
  signups: number;
  material: number;
  activated: number;
  w1Retained: number;
}

/** Learners whose first ever attempt falls in the week starting `weekStart`. */
export interface AdminFirstAttemptWeekRecord {
  weekStart: Date;
  learners: number;
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
  /** Aggregates for ISO weeks in `[from, to)`; both bounds are Monday 00:00 UTC. */
  getActivationAggregates(from: Date, to: Date): Promise<AdminActivationAggregates>;
}
