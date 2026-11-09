/** One ISO week of the week-1 review email panel (RIN-916). */
export interface ReviewEmailWeekViewModel {
  isoWeek: string;
  sent: number;
  /** null when Resend open tracking is off. */
  opened: number | null;
  /** Final day-5 touch (RIN-1304); `sent`/`opened` are the day-2 email. */
  sentD5: number;
  openedD5: number | null;
  unsubscribed: number;
  optIns: number;
}

export interface ReviewEmailStatsViewModel {
  opensTracked: boolean;
  /** Oldest first. */
  weeks: ReviewEmailWeekViewModel[];
}
