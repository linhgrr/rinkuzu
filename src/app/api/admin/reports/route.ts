import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const pageRaw = searchParams.get('page');
    const limitRaw = searchParams.get('limit');
    const searchParamsObj = {
      ...(status ? { search: status } : {}),
      page: pageRaw ? parseInt(pageRaw, 10) : 1,
      limit: limitRaw ? parseInt(limitRaw, 10) : 20,
    };

    const adminService = serviceFactory.getAdminService();
    const result = await adminService.getReports(searchParamsObj);

    if (!result.success) {
      return apiServiceErr(result, 500);
    }

    return apiOk(result.data);
  } catch (error) {
    logger.error({ error }, 'Error fetching reports');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
