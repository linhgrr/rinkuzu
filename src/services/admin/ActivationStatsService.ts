import type {
  AdminActivationBreakdownDto,
  AdminActivationStatsDto,
  AdminActivationWeekDto,
} from '@/dtos/admin-stats';
import { adminActivationStatsSchema } from '@/dtos/admin-stats';
import type {
  ActivationEmailWeekRecord,
  IActivationEmailStatsRepository,
} from '@/interfaces/repositories/IActivationEmailStatsRepository';
import type {
  ActivationSegmentBy,
  IActivationSegmentStatsRepository,
} from '@/interfaces/repositories/IActivationSegmentStatsRepository';
import type { IAdminAuditRepository } from '@/interfaces/repositories/IAdminAuditRepository';
import type {
  AdminActivationAggregates,
  AdminActivationCohortPathCounts,
  AdminActivationPathCounts,
  AdminAdaptiveLearnerEvents,
  IAdminStatsRepository,
} from '@/interfaces/repositories/IAdminStatsRepository';
import { DAY_MS, trailingIsoWeeks } from '@/lib/analytics/iso-week';
import { logger } from '@/lib/logger';
import { buildActivationBreakdown } from '@/services/admin/activation-breakdown';
import type { ServiceResult } from '@/interfaces/services/types';

const ACTIVATION_STATS_CACHE_TTL_MS = 10 * 60_000;
const ACTIVATION_STATS_AUDIT_ACTION = 'stats.activation.read';
const ANALYTICS_SERVICE_ACTOR = 'service:analytics-read';
/**
 * `AdminActionAudit.actorId` is a required ObjectId. A service caller has no
 * user id, so it is recorded under the all-zero id, which no user can have,
 * with `actorEmail` naming the service.
 */
const ANALYTICS_SERVICE_ACTOR_ID = '000000000000000000000000';
/** Adaptive events are fetched up to this long after the last week ends (retention). */
const ADAPTIVE_EVENTS_TAIL_MS = 14 * DAY_MS;
const NO_PATH: AdminActivationPathCounts = { quiz: 0, adaptive: 0, both: 0 };
const NO_COHORT_PATH: AdminActivationCohortPathCounts = { ...NO_PATH, claimedGuest: 0 };

type AdaptiveSourceStatus = AdminActivationStatsDto['sources']['adaptive'];
type ActivationEmailWeekDto = AdminActivationStatsDto['activationEmail']['weeks'][number];
type ActivationEmailCounts = ActivationEmailWeekDto['byTrigger']['24h'];

export type ActivationStatsActor =
  | { kind: 'admin'; userId: string; email: string }
  | { kind: 'service' };

const ACTIVATION_DEFINITIONS: AdminActivationStatsDto['definitions'] = {
  week: 'ISO-8601 week in UTC, Monday 00:00:00.000 to Sunday 23:59:59.999. `end` is the last millisecond of the week.',
  exclusions:
    'Users with role admin, disabled users (disable = 1), users an admin marked as test accounts in /admin/users (isTestAccount = true), and test/QA accounts on reserved example/.test/.invalid/.localhost email domains or in a documented constant list of company-owned addresses are never counted.',
  signups: 'Non-excluded users whose createdAt falls in the week.',
  signedIn:
    'Signups of the week with at least one successful sign-in (login_success audit event, Google sign-ins included) within 7 days of signup.',
  startedQuiz:
    'Signups of the week who, within 7 days of signup, submitted a quiz attempt or had an adaptive completion (every activated signup), or have an unsubmitted quiz with at least one answer saved after signup (in-progress quizzes keep only their last update time). activated <= startedQuiz <= signups.',
  material:
    'Signups of the week who, within 7 days of signup, authored a quiz, submitted an attempt on a quiz they did not author, or had a succeeded upload (Path B). Every activated signup is material.',
  activated:
    'Signups of the week with at least one completed (submitted) quiz attempt or adaptive completion within 7 days of signup. Each learner is counted once.',
  activatedBy:
    'Split of activated by path within the 7-day window: quiz (attempt only), adaptive (adaptive completion only), both. quiz + adaptive + both = activated. claimedGuest is a subset of activated, not a fourth path: activated signups with a qualifying attempt made as a guest and claimed into the account (0 until guest claiming ships).',
  weeklyActivatedLearners:
    'Distinct non-excluded users whose first ever completion, the earlier of their first completed attempt and their first adaptive completion, fell in the week, whatever their signup week. North-star series.',
  weeklyActivatedBy:
    'Split of weeklyActivatedLearners by the path that gave the first ever completion: quiz, adaptive, or both when the first attempt and the first adaptive completion fall in the same week.',
  adaptiveCompletion:
    'Path B: every 5th answered adaptive exercise (an answer was recorded) on one uploaded document, timed at that exercise. A learner with fewer than 5 answers on every document has none.',
  succeededUpload:
    'Path B: an adaptive document-processing job that reached completed, timed at its completion. Failed, cancelled and in-flight jobs do not count.',
  w1Retained:
    'Activated signups of the week who also completed a quiz attempt or an adaptive completion on days 7-13 after signup. null until the youngest signup of the week is 14 days old.',
  w1RetentionRate: 'w1Retained / activated, rounded to 4 decimals; null when either is null or 0.',
  returnedWeek1:
    'Signups of the week with a sign-in, quiz attempt or adaptive completion on a later calendar day in Asia/Ho_Chi_Minh than their signup day, and less than 7 days after signup. Activation is not required. null until 7 days after the end of the week. Weeks themselves stay UTC ISO weeks.',
  complete:
    'true once every number in the row is final: 14 days after the end of the week. The current week and the two before it are partial.',
  sources:
    'sources.adaptive is ok when the Path B events were read from the API, unavailable when that read failed or took over 2 s: every number is then quiz-only, and the response is not cached.',
  limitations:
    'Unsubmitted in-progress quiz attempts are not counted as material. A learner whose session is still live comes back without signing in again, so they count in returnedWeek1 only if they also attempt or complete. Adaptive learners with 1-4 answers and no completion are not visible to the web (Path B reports completions only), so they are missing from startedQuiz. Sign-in events are kept 180 days.',
  activationEmail:
    'One-time activation nudge emails (RIN-999), bucketed by the UTC ISO week they were sent in (the worker slot of the delivery the provider accepted), not by signup week. sent: delivered nudges of non-excluded learners. clicked: sends whose CTA click was recorded (0 until click tracking ships). activatedWithin7d: sends followed by a completed quiz attempt or adaptive completion in [send, send + 7 days); final 7 days after the week ends. byTrigger splits each count by what enqueued the email: 24h (the sweep 24 h after signup) or backfill; the totals are their sums.',
};

interface CacheEntry<T = AdminActivationStatsDto> {
  expiresAt: number;
  value: T;
}

/** Path B events for `[from, to)`; rejects when the API cannot answer. */
type AdaptiveActivationEventsReader = (
  from: Date,
  to: Date,
  actorId: string,
) => Promise<AdminAdaptiveLearnerEvents[]>;

export interface ActivationStatsServiceDeps {
  stats: Pick<IAdminStatsRepository, 'getActivationAggregates'>;
  segments: IActivationSegmentStatsRepository;
  activationEmail: IActivationEmailStatsRepository;
  audit: IAdminAuditRepository;
  adaptiveEvents: AdaptiveActivationEventsReader;
  now?: () => Date;
}

interface AdaptiveEventsRead {
  status: AdaptiveSourceStatus;
  events: AdminAdaptiveLearnerEvents[];
}

export class ActivationStatsService {
  private readonly cache = new Map<number, CacheEntry>();
  /** Keyed `<by>:<weeks>`: a breakdown never answers another `by` or the default. */
  private readonly breakdownCache = new Map<string, CacheEntry<AdminActivationBreakdownDto>>();
  private readonly now: () => Date;

  constructor(private readonly deps: ActivationStatsServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async getWeeklyActivation(
    weeks: number,
    actor: ActivationStatsActor,
  ): Promise<ServiceResult<AdminActivationStatsDto>> {
    try {
      const actorId = actor.kind === 'admin' ? actor.userId : ANALYTICS_SERVICE_ACTOR_ID;
      // One entry per call, cached or not: the audit trail records reads,
      // not database work.
      await this.deps.audit.record({
        actorId,
        actorEmail: actor.kind === 'admin' ? actor.email : ANALYTICS_SERVICE_ACTOR,
        action: ACTIVATION_STATS_AUDIT_ACTION,
        entityType: 'stats',
        entityId: 'activation',
        details: { weeks: String(weeks) },
      });

      const nowMs = this.now().getTime();
      const cached = this.cache.get(weeks);
      if (cached && cached.expiresAt > nowMs) return { success: true, data: cached.value };

      const value = await this.compute(weeks, new Date(nowMs), actorId);
      // A quiz-only answer is served but never cached, so the next read
      // retries the adaptive API instead of repeating the undercount.
      if (value.sources.adaptive === 'ok') {
        this.cache.set(weeks, { expiresAt: nowMs + ACTIVATION_STATS_CACHE_TTL_MS, value });
      }
      return { success: true, data: value };
    } catch (error) {
      logger.error({ error }, 'Get weekly activation stats error');
      return { success: false, error: 'Failed to get activation statistics', statusCode: 500 };
    }
  }

  /** `?by=locale|country` (RIN-1268): signups and activated per week and segment. */
  async getActivationBreakdown(
    weeks: number,
    by: ActivationSegmentBy,
    actor: ActivationStatsActor,
  ): Promise<ServiceResult<AdminActivationBreakdownDto>> {
    try {
      const actorId = actor.kind === 'admin' ? actor.userId : ANALYTICS_SERVICE_ACTOR_ID;
      await this.deps.audit.record({
        actorId,
        actorEmail: actor.kind === 'admin' ? actor.email : ANALYTICS_SERVICE_ACTOR,
        action: ACTIVATION_STATS_AUDIT_ACTION,
        entityType: 'stats',
        entityId: 'activation',
        details: { weeks: String(weeks), by },
      });

      const nowMs = this.now().getTime();
      const key = `${by}:${weeks}`;
      const cached = this.breakdownCache.get(key);
      if (cached && cached.expiresAt > nowMs) return { success: true, data: cached.value };

      const now = new Date(nowMs);
      const windows = trailingIsoWeeks(now, weeks);
      const from = windows[0]?.start;
      const to = windows[windows.length - 1]?.endExclusive;
      if (!from || !to) throw new Error('weeks must be at least 1');
      const adaptive = await this.readAdaptiveEvents(
        from,
        new Date(to.getTime() + ADAPTIVE_EVENTS_TAIL_MS),
        actorId,
      );
      const records = await this.deps.segments.getActivationSegments(from, to, by, adaptive.events);
      const value = buildActivationBreakdown({
        by,
        windows,
        records,
        now,
        adaptive: adaptive.status,
      });
      if (adaptive.status === 'ok') {
        this.breakdownCache.set(key, {
          expiresAt: nowMs + ACTIVATION_STATS_CACHE_TTL_MS,
          value,
        });
      }
      return { success: true, data: value };
    } catch (error) {
      logger.error({ error }, 'Get activation breakdown error');
      return { success: false, error: 'Failed to get activation statistics', statusCode: 500 };
    }
  }

  private async readAdaptiveEvents(
    from: Date,
    to: Date,
    actorId: string,
  ): Promise<AdaptiveEventsRead> {
    try {
      return { status: 'ok', events: await this.deps.adaptiveEvents(from, to, actorId) };
    } catch (error) {
      // The error names the failure only: no response content, no user data.
      logger.warn(
        { reason: error instanceof Error ? error.message : 'unknown' },
        'Adaptive activation events unavailable; serving quiz-only activation stats',
      );
      return { status: 'unavailable', events: [] };
    }
  }

  private async compute(
    weeks: number,
    now: Date,
    actorId: string,
  ): Promise<AdminActivationStatsDto> {
    const windows = trailingIsoWeeks(now, weeks);
    const first = windows[0];
    const last = windows[windows.length - 1];
    if (!first || !last) throw new Error('weeks must be at least 1');
    const from = first.start;
    const to = last.endExclusive;
    const adaptive = await this.readAdaptiveEvents(
      from,
      new Date(to.getTime() + ADAPTIVE_EVENTS_TAIL_MS),
      actorId,
    );
    const [aggregates, emailSends] = await Promise.all([
      this.deps.stats.getActivationAggregates(from, to, adaptive.events),
      this.deps.activationEmail.getWeeklySends(from, to, adaptive.events),
    ]);
    const rows = buildActivationWeeks(windows, aggregates, now);
    // Parse, not cast: the strict schema is what guarantees nothing but
    // aggregates leaves this service.
    return adminActivationStatsSchema.parse({
      generatedAt: now.toISOString(),
      timezone: 'UTC',
      definitions: ACTIVATION_DEFINITIONS,
      sources: { adaptive: adaptive.status },
      weeks: rows,
      activationEmail: { weeks: buildActivationEmailWeeks(windows, emailSends) },
    });
  }
}

function buildActivationWeeks(
  windows: ReturnType<typeof trailingIsoWeeks>,
  aggregates: AdminActivationAggregates,
  now: Date,
): AdminActivationWeekDto[] {
  const cohorts = new Map(aggregates.cohorts.map((row) => [row.weekStart.getTime(), row]));
  const firsts = new Map(aggregates.firstAttempts.map((row) => [row.weekStart.getTime(), row]));

  return windows.map((window) => {
    const key = window.start.getTime();
    const cohort = cohorts.get(key);
    const activated = cohort?.activated ?? 0;
    const final = now.getTime() >= window.endExclusive.getTime() + 14 * DAY_MS;
    const w1Retained = final ? (cohort?.w1Retained ?? 0) : null;
    const returnFinal = now.getTime() >= window.endExclusive.getTime() + 7 * DAY_MS;
    return {
      isoWeek: window.isoWeek,
      start: window.start.toISOString(),
      end: new Date(window.endExclusive.getTime() - 1).toISOString(),
      signups: cohort?.signups ?? 0,
      signedIn: cohort?.signedIn ?? 0,
      material: cohort?.material ?? 0,
      startedQuiz: cohort?.startedQuiz ?? 0,
      activated,
      activatedBy: cohort?.activatedBy ?? NO_COHORT_PATH,
      weeklyActivatedLearners: firsts.get(key)?.learners ?? 0,
      weeklyActivatedBy: firsts.get(key)?.activatedBy ?? NO_PATH,
      w1Retained,
      w1RetentionRate:
        w1Retained === null || activated === 0
          ? null
          : Math.round((w1Retained / activated) * 10_000) / 10_000,
      returnedWeek1: returnFinal ? (cohort?.returnedWeek1 ?? 0) : null,
      complete: final,
    };
  });
}

const NO_EMAIL: ActivationEmailCounts = { sent: 0, clicked: 0, activatedWithin7d: 0 };

function addEmailCounts(
  total: ActivationEmailCounts,
  row: ActivationEmailCounts,
): ActivationEmailCounts {
  return {
    sent: total.sent + row.sent,
    clicked: total.clicked + row.clicked,
    activatedWithin7d: total.activatedWithin7d + row.activatedWithin7d,
  };
}

/** One row per window, zeros where nothing was sent; totals are the trigger sums. */
function buildActivationEmailWeeks(
  windows: ReturnType<typeof trailingIsoWeeks>,
  sends: readonly ActivationEmailWeekRecord[],
): ActivationEmailWeekDto[] {
  return windows.map((window) => {
    const key = window.start.getTime();
    const byTrigger = { '24h': NO_EMAIL, backfill: NO_EMAIL };
    for (const row of sends) {
      if (row.weekStart.getTime() !== key) continue;
      byTrigger[row.trigger] = addEmailCounts(byTrigger[row.trigger], row);
    }
    return {
      isoWeek: window.isoWeek,
      ...addEmailCounts(byTrigger['24h'], byTrigger.backfill),
      byTrigger,
    };
  });
}
