import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { getAdminService } from '@/lib/admin-factory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { adminReportListQuerySchema } from '@/dtos/admin-report';
import { readAndValidateSearchParams } from '@/lib/api/request';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const query = readAndValidateSearchParams(request, adminReportListQuerySchema);
    if (!query.success) {
      return apiErr('validation_error', query.error, 400, { fields: query.fields });
    }

    const adminService = getAdminService();
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
