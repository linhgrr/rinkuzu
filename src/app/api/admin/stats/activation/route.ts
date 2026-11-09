import { withAnalyticsReadOrAdmin } from '@/lib/api/analytics-read-auth';
import { getActivationStatsService } from '@/lib/admin-factory';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { adminActivationQuerySchema } from '@/dtos/admin-stats';
import { parseSearchParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

export const GET = withAnalyticsReadOrAdmin(async (req, actor) => {
  const query = parseSearchParams(req, adminActivationQuerySchema);
  if (!query.ok) return query.response;

  try {
    const { weeks, by } = query.data;
    const service = getActivationStatsService();
    const result = by
      ? await service.getActivationBreakdown(weeks, by, actor)
      : await service.getWeeklyActivation(weeks, actor);
    if (!result.success) {
      return apiErr('internal_error', result.error, result.statusCode);
    }
    const response = apiOk(result.data);
    // Authenticated data: never in a shared cache. The service caches it.
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error) {
    logger.error({ error }, 'Error fetching activation stats');
    return apiErr('internal_error', 'Failed to fetch activation statistics', 500);
  }
});
