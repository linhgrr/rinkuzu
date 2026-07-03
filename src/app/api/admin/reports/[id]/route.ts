import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { readAndValidateJson } from '@/lib/api/request';
import { logger } from '@/lib/logger';
import { adminReportIdParamsSchema, updateAdminReportRequestSchema } from '@/dtos/admin-report';

export const dynamic = 'force-dynamic';

export const PATCH = withAdmin(async (request: NextRequest, context) => {
  try {
    const params = adminReportIdParamsSchema.safeParse(context.params);
    if (!params.success) {
      return apiErr(
        'validation_error',
        params.error.issues[0]?.message ?? 'Invalid report ID',
        400,
      );
    }

    const input = await readAndValidateJson(request, updateAdminReportRequestSchema);
    if (!input.success) {
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    }

    const adminService = serviceFactory.getAdminService();
    const result = await adminService.updateReportStatus(params.data.id, input.data, context.email);

    if (!result.success) {
      return apiServiceErr(result);
    }

    return apiOk(result.data);
  } catch (error: unknown) {
    logger.error({ error }, 'Error updating report');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

export const DELETE = withAdmin(async (request: NextRequest, context) => {
  try {
    const params = adminReportIdParamsSchema.safeParse(context.params);
    if (!params.success) {
      return apiErr(
        'validation_error',
        params.error.issues[0]?.message ?? 'Invalid report ID',
        400,
      );
    }

    const adminService = serviceFactory.getAdminService();
    const result = await adminService.deleteReport(params.data.id);

    if (!result.success) {
      return apiServiceErr(result);
    }

    return apiOk(result.data, 200, { meta: { message: 'Report deleted successfully' } });
  } catch (error: unknown) {
    logger.error({ error }, 'Error deleting report');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
