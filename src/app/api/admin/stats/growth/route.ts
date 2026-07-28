import { withAdmin } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { adminGrowthQuerySchema } from '@/dtos/admin-stats';
import { readAndValidateSearchParams } from '@/lib/api/request';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (req: Request) => {
  const query = readAndValidateSearchParams(req, adminGrowthQuerySchema);
  if (!query.success) {
    return apiErr('validation_error', query.error, 400, { fields: query.fields });
  }

  try {
    const adminService = serviceFactory.getAdminService();
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
