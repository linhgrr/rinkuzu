import { withAdmin } from '@/lib/api/auth';
import { getAdminService } from '@/lib/admin-factory';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { adminGrowthQuerySchema } from '@/dtos/admin-stats';
import { parseSearchParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (req: Request) => {
  const query = parseSearchParams(req, adminGrowthQuerySchema);
  if (!query.ok) return query.response;

  try {
    const adminService = getAdminService();
    const result = await adminService.getGrowthTrends(query.data.days);

    if (!result.success) {
      return apiErr(
        result.statusCode === 503 ? 'service_unavailable' : 'internal_error',
        result.error,
        result.statusCode ?? 500,
      );
    }

    return apiOk(result.data);
  } catch (error) {
    logger.error({ error }, 'Error fetching growth trends');
    return apiErr('internal_error', 'Failed to fetch growth trends', 500);
  }
});
