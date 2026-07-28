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

/**
 * Read-only analytics queries kept separate from domain repositories so adding a
 * dashboard metric does not expand every quiz/user/attempt test double.
 */
export interface IAdminStatsRepository {
  getDailyActivity(since: Date): Promise<AdminStatsDailyActivity>;
  getScoreDistribution(): Promise<AdminStatsScoreBucket[]>;
}
