/**
 * Weekly aggregates of the opt-in week-1 review email (RIN-911 AC6). Counts
 * only: no learner ids, addresses or email content cross this port.
 */
export interface ReviewEmailSendWeek {
  /** Monday 00:00 UTC of the ISO week. */
  readonly weekStart: Date;
  readonly sent: number;
  readonly opened: number;
}

export interface ReviewEmailConsentWeek {
  /** Monday 00:00 UTC of the ISO week. */
  readonly weekStart: Date;
  readonly optIns: number;
  readonly unsubscribed: number;
}

export interface ReviewEmailWeeklyCounts {
  readonly sends: readonly ReviewEmailSendWeek[];
  readonly consents: readonly ReviewEmailConsentWeek[];
  /** Whether any `email.opened` webhook is on record (Resend open tracking on). */
  readonly opensTracked: boolean;
}

export interface IReviewEmailStatsRepository {
  /**
   * Counts for `[from, to)`, excluding non-learner accounts (the analytics
   * exclusions) and the review-email QA recipients in `qaEmails`.
   */
  getWeeklyCounts(
    from: Date,
    to: Date,
    qaEmails: readonly string[],
  ): Promise<ReviewEmailWeeklyCounts>;
}
