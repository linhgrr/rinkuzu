import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { adminStatsListQuerySchema } from '@/dtos/admin-stats';
import { buildPaginationMeta } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const searchParams = new URL(request.url).searchParams;
    const query = adminStatsListQuerySchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });
    if (!query.success) {
      return apiErr('validation_error', query.error.issues[0]?.message ?? 'Invalid query', 400);
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
