/** One UTC ISO week of the guest funnel (RIN-1711). Counts only: no ids, tokens or addresses. */
export interface GuestFunnelWeekRecord {
  /** Monday 00:00 UTC of the ISO week. */
  readonly weekStart: Date;
  /** Guest attempts submitted in the week, claimed or not. */
  readonly guestCompleted: number;
  /** Of those, claimed within 7 days of being taken. */
  readonly guestClaimed7d: number;
  /** `guest_result_review` opt-in consent events in the week. */
  readonly reviewOptInFromGuest: number;
}

export interface IGuestFunnelStatsRepository {
  /** Weeks of `[from, to)` that have any guest activity, without analytics-excluded accounts. */
  getWeeklyGuestFunnel(from: Date, to: Date): Promise<GuestFunnelWeekRecord[]>;
}
