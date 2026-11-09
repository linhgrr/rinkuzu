import type { AdminReviewEmailStatsDto } from '@/dtos/admin-stats';
import type { ReviewEmailStatsViewModel } from '@/features/admin/stats/types/review-email-view-model';
import { fetchApiData } from '@/lib/api/client';

/** Week-1 review email aggregates, 8 ISO weeks (RIN-916). */
export async function fetchReviewEmailStats(
  signal?: AbortSignal,
): Promise<ReviewEmailStatsViewModel> {
  const dto = await fetchApiData<AdminReviewEmailStatsDto>(
    '/api/admin/stats/review-email?weeks=8',
    { cache: 'no-store', ...(signal ? { signal } : {}) },
  );
  return {
    opensTracked: dto.opensTracked,
    weeks: dto.weeks.map(({ isoWeek, sent, opened, sentD5, openedD5, unsubscribed, optIns }) => ({
      isoWeek,
      sent,
      opened,
      sentD5,
      openedD5,
      unsubscribed,
      optIns,
    })),
  };
}
