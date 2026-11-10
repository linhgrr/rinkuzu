import type {
  ActivationSegmentBy,
  ActivationSegmentWeekRecord,
} from '@/interfaces/repositories/IActivationSegmentStatsRepository';

/** The User field a segmented cohort pipeline groups by (RIN-1268). */
export type ActivationSegmentField = 'signupLocale' | 'signupCountry';

export const SEGMENT_FIELDS: Record<ActivationSegmentBy, ActivationSegmentField> = {
  locale: 'signupLocale',
  country: 'signupCountry',
};

interface SegmentCohortKey {
  weekStart: Date;
  segment?: unknown;
}

/** A segmented cohort row; only the counts the breakdown serves are read. */
export interface SegmentCohortAggregate {
  _id: SegmentCohortKey;
  signups: number;
  activated: number;
}

export function toSegmentWeekRecord(row: SegmentCohortAggregate): ActivationSegmentWeekRecord {
  return {
    weekStart: row._id.weekStart,
    segment: typeof row._id.segment === 'string' ? row._id.segment : null,
    signups: row.signups,
    activated: row.activated,
  };
}

/**
 * Fragments that carry `field` through the cohort pipeline and group by
 * `{weekStart, segment}`; all empty (and the week key unchanged) without one.
 */
export interface SegmentStages {
  source: Record<string, unknown>;
  perUser: Record<string, unknown>;
  perSignup: Record<string, unknown>;
  weekKey: string | Record<string, string>;
}

export function segmentStages(field?: ActivationSegmentField): SegmentStages {
  if (field === undefined) {
    return { source: {}, perUser: {}, perSignup: {}, weekKey: '$weekStart' };
  }
  return {
    source: { segment: { $ifNull: ['$' + field, null] } },
    perUser: { segment: { $max: '$segment' } },
    perSignup: { segment: 1 },
    weekKey: { weekStart: '$weekStart', segment: '$segment' },
  };
}
