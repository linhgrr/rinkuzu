import type { AdminAdaptiveLearnerEvents } from '@/interfaces/repositories/IAdminStatsRepository';

/** What `GET /api/admin/stats/activation?by=` splits signups by (RIN-1268). */
export type ActivationSegmentBy = 'locale' | 'country';

/**
 * Signups of the week starting `weekStart` whose signup field (`signupLocale`
 * or `signupCountry`) equals `segment`, null when the account has none.
 * Aggregates only: no user ids.
 */
export interface ActivationSegmentWeekRecord {
  weekStart: Date;
  segment: string | null;
  signups: number;
  activated: number;
}

/**
 * The cohort activation counts of `IAdminStatsRepository.getActivationAggregates`,
 * split by a signup field. A separate interface so the existing stats test
 * doubles do not grow.
 */
export interface IActivationSegmentStatsRepository {
  getActivationSegments(
    from: Date,
    to: Date,
    by: ActivationSegmentBy,
    adaptive?: readonly AdminAdaptiveLearnerEvents[],
  ): Promise<ActivationSegmentWeekRecord[]>;
}
