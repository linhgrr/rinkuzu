import type { AdminAdaptiveLearnerEvents } from '@/interfaces/repositories/IAdminStatsRepository';

/** What enqueued the activation nudge (RIN-999). */
export type ActivationEmailTrigger = '24h' | 'backfill';

/**
 * One send week and trigger of activation nudges (RIN-1001). Counts only: no
 * learner ids, addresses or email content cross this port.
 */
export interface ActivationEmailWeekRecord {
  /** Monday 00:00 UTC of the ISO week the email was sent in. */
  readonly weekStart: Date;
  readonly trigger: ActivationEmailTrigger;
  readonly sent: number;
  /** Sends with a recorded `clickedAt` (0 until click tracking ships, RIN-1000). */
  readonly clicked: number;
  /** Sends followed by a completed attempt or adaptive completion within 7 days. */
  readonly activatedWithin7d: number;
}

export interface IActivationEmailStatsRepository {
  /**
   * Sent nudges in `[from, to)` by send week and trigger, without
   * analytics-excluded accounts. `adaptive` holds the Path B completions
   * (read once by the caller) that count as activation next to attempts.
   */
  getWeeklySends(
    from: Date,
    to: Date,
    adaptive: readonly AdminAdaptiveLearnerEvents[],
  ): Promise<ActivationEmailWeekRecord[]>;
}
