import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { adminStatsListQuerySchema } from '@/dtos/admin-stats';
import { buildPaginationMeta } from '@/lib/pagination';
import { readAndValidateSearchParams } from '@/lib/api/request';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const query = readAndValidateSearchParams(request, adminStatsListQuerySchema);
    if (!query.success) {
      return apiErr('validation_error', query.error, 400, { fields: query.fields });
    }

    const adminService = serviceFactory.getAdminService();
    const result = await adminService.getCreatorStats(query.data.limit);

    if (!result.success) {
      return apiServiceErr(result);
    }

    return apiOk({
      creators: result.data,
      pagination: buildPaginationMeta(query.data.page, query.data.limit, result.data.length),
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching creator stats');
    return apiErr('internal_error', 'Failed to fetch creator statistics', 500);
  }
});
