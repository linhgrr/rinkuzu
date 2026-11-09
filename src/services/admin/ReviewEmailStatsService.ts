import type { AdminReviewEmailStatsDto } from '@/dtos/admin-stats';
import { adminReviewEmailStatsSchema } from '@/dtos/admin-stats';
import type { IReviewEmailStatsRepository } from '@/interfaces/repositories/IReviewEmailStatsRepository';
import type { ServiceResult } from '@/interfaces/services/types';
import { trailingIsoWeeks } from '@/lib/analytics/iso-week';
import { logger } from '@/lib/logger';

export interface ReviewEmailStatsServiceDeps {
  stats: IReviewEmailStatsRepository;
  /** Review-email QA recipients (`REVIEW_EMAIL_QA_RECIPIENTS`), left out of every count. */
  qaEmails: () => readonly string[];
  now?: () => Date;
}

/** Week-1 review email panel in /admin/stats (RIN-911 AC6): weekly aggregates only. */
export class ReviewEmailStatsService {
  private readonly now: () => Date;

  constructor(private readonly deps: ReviewEmailStatsServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async getWeekly(weeks: number): Promise<ServiceResult<AdminReviewEmailStatsDto>> {
    try {
      const now = this.now();
      const windows = trailingIsoWeeks(now, weeks);
      const first = windows[0];
      const last = windows.at(-1);
      if (!first || !last) throw new Error('No ISO weeks in the window');
      const counts = await this.deps.stats.getWeeklyCounts(
        first.start,
        last.endExclusive,
        this.deps.qaEmails(),
      );
      const sends = new Map(counts.sends.map((row) => [row.weekStart.getTime(), row]));
      const consents = new Map(counts.consents.map((row) => [row.weekStart.getTime(), row]));
      // Strict parse: a field the contract does not name never reaches the client.
      const data = adminReviewEmailStatsSchema.parse({
        generatedAt: now.toISOString(),
        timezone: 'UTC',
        opensTracked: counts.opensTracked,
        weeks: windows.map((window) => {
          const send = sends.get(window.start.getTime());
          const consent = consents.get(window.start.getTime());
          return {
            isoWeek: window.isoWeek,
            start: window.start.toISOString(),
            end: new Date(window.endExclusive.getTime() - 1).toISOString(),
            sent: send?.sent ?? 0,
            opened: counts.opensTracked ? (send?.opened ?? 0) : null,
            sentD5: send?.sentD5 ?? 0,
            openedD5: counts.opensTracked ? (send?.openedD5 ?? 0) : null,
            unsubscribed: consent?.unsubscribed ?? 0,
            optIns: consent?.optIns ?? 0,
          };
        }),
      });
      return { success: true, data };
    } catch (error) {
      logger.error({ error }, 'Get review email stats error');
      return { success: false, error: 'Failed to get review email statistics', statusCode: 500 };
    }
  }
}
