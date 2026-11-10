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

/**
 * The cohort's path split plus `claimedGuest`: activated learners with a
 * qualifying attempt they claimed from a guest session. A subset, not a fourth path.
 */
export interface AdminActivationCohortPathCounts extends AdminActivationPathCounts {
  claimedGuest: number;
  /** Of `claimedGuest`: the attempt was on the guest's own-PDF quiz (RIN-1447). */
  claimedGuestDraft: number;
}

/**
 * Per-signup-week cohort counts; `weekStart` is Monday 00:00 UTC. The funnel
 * runs signups ⊇ startedQuiz ⊇ activated, all within 7 days of signup.
 */
interface AdminActivationCohortRecord {
  weekStart: Date;
  signups: number;
  material: number;
  activated: number;
  activatedBy: AdminActivationCohortPathCounts;
  w1Retained: number;
  /** At least one `login_success` within 7 days of signup. */
  signedIn: number;
  /** Activated, or an unsubmitted quiz with an answer updated after signup. */
  startedQuiz: number;
  /** A sign-in, attempt or adaptive completion on a later Asia/Ho_Chi_Minh day, within 7 days. */
  returnedWeek1: number;
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

/**
 * Activated signups by the entry of their first qualifying attempt (RIN-1256).
 * `none`: no tracked entry (older attempts, untracked links, adaptive-only learners).
 */
export interface AdminActivationEntryCounts {
  blog: number;
  landing: number;
  post_signin_starter: number;
  activation_email: number;
  /** A topic hub card (`entry=hub`, RIN-1417). */
  hub: number;
  none: number;
}

/** A public blog post slug and its activated signups. */
interface AdminActivationBlogPostCount {
  post: string;
  activated: number;
}

/** Per signup week, like the cohorts; only weeks that have a cohort row. */
export interface AdminActivationEntryWeekRecord {
  weekStart: Date;
  activatedByEntry: AdminActivationEntryCounts;
  /** Top 10 public blog post slugs by activated signups, most first, then by slug. */
  blogPosts: AdminActivationBlogPostCount[];
}

export interface AdminActivationAggregates {
  cohorts: AdminActivationCohortRecord[];
  firstAttempts: AdminFirstAttemptWeekRecord[];
  cohortEntries: AdminActivationEntryWeekRecord[];
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
