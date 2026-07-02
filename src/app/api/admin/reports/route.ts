import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { adminReportListQuerySchema } from '@/dtos/admin-report';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const query = adminReportListQuerySchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      status: searchParams.get('status') ?? undefined,
    });
    if (!query.success) {
      return apiErr('validation_error', query.error.issues[0]?.message ?? 'Invalid query', 400);
    }

    const adminService = serviceFactory.getAdminService();
    const result = await adminService.getReports(query.data);

    if (!result.success) {
      return apiServiceErr(result);
    }

    return apiOk(result.data);
  } catch (error) {
    logger.error({ error }, 'Error fetching reports');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
