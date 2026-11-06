import { withAdmin } from '@/lib/api/auth';
import { getReviewEmailStatsService } from '@/lib/admin-factory';
import { apiErr, apiOk } from '@/lib/api/response';
// Same window as activation: 1-26 ISO weeks, 8 by default.
import { adminActivationQuerySchema } from '@/dtos/admin-stats';
import { parseSearchParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

/** Week-1 review email aggregates for /admin/stats (RIN-916). Admin only. */
export const GET = withAdmin(async (req: Request) => {
  const query = parseSearchParams(req, adminActivationQuerySchema);
  if (!query.ok) return query.response;

  const result = await getReviewEmailStatsService().getWeekly(query.data.weeks);
  if (!result.success) {
    return apiErr('internal_error', result.error, result.statusCode ?? 500);
  }
  const response = apiOk(result.data);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
});
