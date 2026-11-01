import type { AdminActivationStatsDto, AdminActivationWeekDto } from '@/dtos/admin-stats';
import { adminActivationStatsSchema } from '@/dtos/admin-stats';
import type { IAdminAuditRepository } from '@/interfaces/repositories/IAdminAuditRepository';
import type {
  AdminActivationAggregates,
  IAdminStatsRepository,
} from '@/interfaces/repositories/IAdminStatsRepository';
import { DAY_MS, trailingIsoWeeks } from '@/lib/analytics/iso-week';
import { logger } from '@/lib/logger';
import type { ServiceResult } from '@/interfaces/services/types';

export const ACTIVATION_STATS_CACHE_TTL_MS = 10 * 60_000;
export const ACTIVATION_STATS_AUDIT_ACTION = 'stats.activation.read';
export const ANALYTICS_SERVICE_ACTOR = 'service:analytics-read';
/**
 * `AdminActionAudit.actorId` is a required ObjectId. A service caller has no
 * user id, so it is recorded under the all-zero id, which no user can have,
 * with `actorEmail` naming the service.
 */
export const ANALYTICS_SERVICE_ACTOR_ID = '000000000000000000000000';

export type ActivationStatsActor =
  | { kind: 'admin'; userId: string; email: string }
  | { kind: 'service' };

export const ACTIVATION_DEFINITIONS: AdminActivationStatsDto['definitions'] = {
  week: 'ISO-8601 week in UTC, Monday 00:00:00.000 to Sunday 23:59:59.999. `end` is the last millisecond of the week.',
  exclusions:
    'Users with role admin, disabled users (disable = 1), and test/QA accounts (reserved example/.test/.invalid/.localhost email domains plus a documented constant list) are never counted.',
  signups: 'Non-excluded users whose createdAt falls in the week.',
  material:
    'Signups of the week who, within 7 days of signup, authored a quiz or submitted an attempt on a quiz they did not author.',
  activated:
    'Signups of the week with at least one completed (submitted) attempt within 7 days of signup.',
  weeklyActivatedLearners:
    'Distinct non-excluded users whose first ever completed attempt was taken in the week, whatever their signup week. North-star series.',
  w1Retained:
    'Activated signups of the week who also completed an attempt on days 7-13 after signup. null until the youngest signup of the week is 14 days old.',
  w1RetentionRate: 'w1Retained / activated, rounded to 4 decimals; null when either is null or 0.',
  complete:
    'true once every number in the row is final: 14 days after the end of the week. The current week and the two before it are partial.',
  limitations:
    'Adaptive uploads/sessions not counted in v1 (they live in the API database). Unsubmitted in-progress quiz attempts are not counted as material.',
};

interface CacheEntry {
  expiresAt: number;
  value: AdminActivationStatsDto;
}

export interface ActivationStatsServiceDeps {
  stats: Pick<IAdminStatsRepository, 'getActivationAggregates'>;
  audit: IAdminAuditRepository;
  now?: () => Date;
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
      // One entry per call, cached or not: the audit trail records reads,
      // not database work.
      await this.deps.audit.record({
        actorId: actor.kind === 'admin' ? actor.userId : ANALYTICS_SERVICE_ACTOR_ID,
        actorEmail: actor.kind === 'admin' ? actor.email : ANALYTICS_SERVICE_ACTOR,
        action: ACTIVATION_STATS_AUDIT_ACTION,
        entityType: 'stats',
        entityId: 'activation',
        details: { weeks: String(weeks) },
      });

      const nowMs = this.now().getTime();
      const cached = this.cache.get(weeks);
      if (cached && cached.expiresAt > nowMs) return { success: true, data: cached.value };

      const value = await this.compute(weeks, new Date(nowMs));
      this.cache.set(weeks, { expiresAt: nowMs + ACTIVATION_STATS_CACHE_TTL_MS, value });
      return { success: true, data: value };
    } catch (error) {
      logger.error({ error }, 'Get weekly activation stats error');
      return { success: false, error: 'Failed to get activation statistics', statusCode: 500 };
    }
  }

  private async compute(weeks: number, now: Date): Promise<AdminActivationStatsDto> {
    const windows = trailingIsoWeeks(now, weeks);
    const first = windows[0];
    const last = windows[windows.length - 1];
    if (!first || !last) throw new Error('weeks must be at least 1');
    const from = first.start;
    const to = last.endExclusive;
    const aggregates = await this.deps.stats.getActivationAggregates(from, to);
    const rows = buildActivationWeeks(windows, aggregates, now);
    // Parse, not cast: the strict schema is what guarantees nothing but
    // aggregates leaves this service.
    return adminActivationStatsSchema.parse({
      generatedAt: now.toISOString(),
      timezone: 'UTC',
      definitions: ACTIVATION_DEFINITIONS,
      weeks: rows,
    });
  }
}

export function buildActivationWeeks(
  windows: ReturnType<typeof trailingIsoWeeks>,
  aggregates: AdminActivationAggregates,
  now: Date,
): AdminActivationWeekDto[] {
  const cohorts = new Map(aggregates.cohorts.map((row) => [row.weekStart.getTime(), row]));
  const learners = new Map(
    aggregates.firstAttempts.map((row) => [row.weekStart.getTime(), row.learners]),
  );

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
      weeklyActivatedLearners: learners.get(key) ?? 0,
      w1Retained,
      w1RetentionRate:
        w1Retained === null || activated === 0
          ? null
          : Math.round((w1Retained / activated) * 10_000) / 10_000,
      complete: final,
    };
  });
}
