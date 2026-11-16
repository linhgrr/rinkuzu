import type { AdminActivationBreakdownDto } from '@/dtos/admin-stats';
import { adminActivationBreakdownSchema } from '@/dtos/admin-stats';
import type {
  ActivationSegmentBy,
  ActivationSegmentWeekRecord,
} from '@/interfaces/repositories/IActivationSegmentStatsRepository';
import { DAY_MS, type IsoWeekWindow } from '@/lib/analytics/iso-week';

type SegmentCounts = { signups: number; activated: number; startedQuiz?: number };

/** Countries with fewer signups than this over the whole window fold into `other`. */
const COUNTRY_FOLD_MIN_SIGNUPS = 3;

const LOCALE_KEYS = ['en', 'vi', 'unknown'] as const;
/** `by=source` lists this many buckets by whole-window signups; the rest fold into `other`. */
const SOURCE_TOP_BUCKETS = 10;

const SOURCE_VALUE = /^[a-z0-9._~-]{1,64}$/;
const COUNTRY_CODE = /^[A-Z]{2}$/;

const BREAKDOWN_DEFINITIONS: AdminActivationBreakdownDto['definitions'] = {
  segments:
    'by=locale: the UI locale of the signup page (en, vi); by=country: the ISO-3166 alpha-2 country of the signup request (Vercel IP geolocation). unknown: the account has no value, which includes every account created before the fields existed (RIN-1268). by=country only: other sums the countries with fewer than 3 signups in the whole requested window. by=source: the first touch of the signup (RIN-1762): utm_source as stored (lowercase), else referrer_class (direct, internal, search, social, referral), else unknown; only the 10 buckets with the most signups over the whole window are listed and the rest sum into other. by=source also returns startedQuiz per segment: signups with a completed or in-progress quiz. Every week lists every key of `segments`, with zeros where there were none.',
  signups:
    'Non-excluded users whose createdAt falls in the week, as in the default response; the segments of a week sum to its signups.',
  activated:
    'Signups of the week with at least one completed (submitted) quiz attempt or adaptive completion within 7 days of signup, exactly as `activated` in the default response.',
  complete: 'true once activated is final: 7 days after the end of the week.',
};

function localeKey(segment: string | null): string {
  return segment === 'en' || segment === 'vi' ? segment : 'unknown';
}

function countryKey(segment: string | null): string {
  return segment !== null && COUNTRY_CODE.test(segment) ? segment : 'unknown';
}

function sourceKey(segment: string | null): string {
  return segment !== null && SOURCE_VALUE.test(segment) ? segment : 'unknown';
}

/** Maps each raw segment to its key; small countries become `other`. */
function segmentKeyFor(
  by: ActivationSegmentBy,
  records: readonly ActivationSegmentWeekRecord[],
): (segment: string | null) => string {
  if (by === 'locale') return localeKey;
  const rawKey = by === 'source' ? sourceKey : countryKey;
  const totals = new Map<string, number>();
  for (const row of records) {
    const key = rawKey(row.segment);
    totals.set(key, (totals.get(key) ?? 0) + row.signups);
  }
  if (by === 'source') {
    const kept = new Set(sortedKeys(totals).slice(0, SOURCE_TOP_BUCKETS));
    return (segment) => {
      const key = sourceKey(segment);
      return key === 'unknown' || kept.has(key) ? key : 'other';
    };
  }
  return (segment) => {
    const key = countryKey(segment);
    return key === 'unknown' || (totals.get(key) ?? 0) >= COUNTRY_FOLD_MIN_SIGNUPS ? key : 'other';
  };
}

/** Keys other than `other` and `unknown`, by signups (desc), then key. */
function sortedKeys(totals: ReadonlyMap<string, number>): string[] {
  return [...totals.keys()]
    .filter((key) => key !== 'other' && key !== 'unknown')
    .sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0) || a.localeCompare(b));
}

/** Named keys by signups (desc, then key), then `other`, then `unknown`. */
function orderKeys(by: ActivationSegmentBy, totals: ReadonlyMap<string, number>): string[] {
  if (by === 'locale') return [...LOCALE_KEYS];
  return [...sortedKeys(totals), ...['other', 'unknown'].filter((key) => totals.has(key))];
}

/** Zero counts; `startedQuiz` only for `by=source`. */
function emptyCounts(by: ActivationSegmentBy): SegmentCounts {
  return by === 'source'
    ? { signups: 0, activated: 0, startedQuiz: 0 }
    : { signups: 0, activated: 0 };
}

export interface ActivationBreakdownInput {
  by: ActivationSegmentBy;
  windows: readonly IsoWeekWindow[];
  records: readonly ActivationSegmentWeekRecord[];
  now: Date;
  adaptive: AdminActivationBreakdownDto['sources']['adaptive'];
}

/** Folds segment rows into one row per window; parsed, so only aggregates leave. */
export function buildActivationBreakdown(
  input: ActivationBreakdownInput,
): AdminActivationBreakdownDto {
  const keyOf = segmentKeyFor(input.by, input.records);
  const cells = new Map<string, SegmentCounts>();
  const totals = new Map<string, number>();
  for (const row of input.records) {
    const key = keyOf(row.segment);
    const cellKey = `${row.weekStart.getTime()}|${key}`;
    const cell = cells.get(cellKey) ?? emptyCounts(input.by);
    cells.set(cellKey, {
      signups: cell.signups + row.signups,
      activated: cell.activated + row.activated,
      ...(input.by === 'source' ? { startedQuiz: (cell.startedQuiz ?? 0) + row.startedQuiz } : {}),
    });
    totals.set(key, (totals.get(key) ?? 0) + row.signups);
  }
  const keys = orderKeys(input.by, totals);
  const nowMs = input.now.getTime();

  return adminActivationBreakdownSchema.parse({
    generatedAt: input.now.toISOString(),
    timezone: 'UTC',
    by: input.by,
    definitions: BREAKDOWN_DEFINITIONS,
    sources: { adaptive: input.adaptive },
    segments: keys,
    weeks: input.windows.map((window) => ({
      isoWeek: window.isoWeek,
      start: window.start.toISOString(),
      end: new Date(window.endExclusive.getTime() - 1).toISOString(),
      complete: nowMs >= window.endExclusive.getTime() + 7 * DAY_MS,
      segments: Object.fromEntries(
        keys.map((key) => [
          key,
          cells.get(`${window.start.getTime()}|${key}`) ?? emptyCounts(input.by),
        ]),
      ),
    })),
  });
}
