import type { AdminActivationStatsDto, AdminActivationWeekDto } from '@/dtos/admin-stats';
import { adminActivationStatsSchema } from '@/dtos/admin-stats';
import type { IAdminAuditRepository } from '@/interfaces/repositories/IAdminAuditRepository';
import type {
  AdminActivationAggregates,
  AdminActivationPathCounts,
  AdminAdaptiveLearnerEvents,
  IAdminStatsRepository,
} from '@/interfaces/repositories/IAdminStatsRepository';
import { DAY_MS, trailingIsoWeeks } from '@/lib/analytics/iso-week';
import { logger } from '@/lib/logger';
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

type AdaptiveSourceStatus = AdminActivationStatsDto['sources']['adaptive'];

export type ActivationStatsActor =
  | { kind: 'admin'; userId: string; email: string }
  | { kind: 'service' };

const ACTIVATION_DEFINITIONS: AdminActivationStatsDto['definitions'] = {
  week: 'ISO-8601 week in UTC, Monday 00:00:00.000 to Sunday 23:59:59.999. `end` is the last millisecond of the week.',
  exclusions:
    'Users with role admin, disabled users (disable = 1), and test/QA accounts (reserved example/.test/.invalid/.localhost email domains plus a documented constant list) are never counted.',
  signups: 'Non-excluded users whose createdAt falls in the week.',
  material:
    'Signups of the week who, within 7 days of signup, authored a quiz, submitted an attempt on a quiz they did not author, or had a succeeded upload (Path B). Every activated signup is material.',
  activated:
    'Signups of the week with at least one completed (submitted) quiz attempt or adaptive completion within 7 days of signup. Each learner is counted once.',
  activatedBy:
    'Split of activated by path within the 7-day window: quiz (attempt only), adaptive (adaptive completion only), both. quiz + adaptive + both = activated.',
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
  complete:
    'true once every number in the row is final: 14 days after the end of the week. The current week and the two before it are partial.',
  sources:
    'sources.adaptive is ok when the Path B events were read from the API, unavailable when that read failed or took over 2 s: every number is then quiz-only, and the response is not cached.',
  limitations: 'Unsubmitted in-progress quiz attempts are not counted as material.',
};

interface CacheEntry {
  expiresAt: number;
  value: AdminActivationStatsDto;
}

/** Path B events for `[from, to)`; rejects when the API cannot answer. */
type AdaptiveActivationEventsReader = (
  from: Date,
  to: Date,
  actorId: string,
) => Promise<AdminAdaptiveLearnerEvents[]>;

export interface ActivationStatsServiceDeps {
  stats: Pick<IAdminStatsRepository, 'getActivationAggregates'>;
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
    const aggregates = await this.deps.stats.getActivationAggregates(from, to, adaptive.events);
    const rows = buildActivationWeeks(windows, aggregates, now);
    // Parse, not cast: the strict schema is what guarantees nothing but
    // aggregates leaves this service.
    return adminActivationStatsSchema.parse({
      generatedAt: now.toISOString(),
      timezone: 'UTC',
      definitions: ACTIVATION_DEFINITIONS,
      sources: { adaptive: adaptive.status },
      weeks: rows,
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
    return {
      isoWeek: window.isoWeek,
      start: window.start.toISOString(),
      end: new Date(window.endExclusive.getTime() - 1).toISOString(),
      signups: cohort?.signups ?? 0,
      material: cohort?.material ?? 0,
      activated,
      activatedBy: cohort?.activatedBy ?? NO_PATH,
      weeklyActivatedLearners: firsts.get(key)?.learners ?? 0,
      weeklyActivatedBy: firsts.get(key)?.activatedBy ?? NO_PATH,
      w1Retained,
      w1RetentionRate:
        w1Retained === null || activated === 0
          ? null
          : Math.round((w1Retained / activated) * 10_000) / 10_000,
      complete: final,
    };
  });
}
