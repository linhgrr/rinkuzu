import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const PATCH = withAdmin(async (request: NextRequest, context) => {
  try {
    const rawId = context.params['id'];
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) {
      return apiErr('validation_error', 'Report id is required', 400);
    }
    const { status } = await request.json();

    if (!['pending', 'resolved', 'dismissed'].includes(status)) {
      return apiErr('validation_error', 'Invalid status', 400);
    }

    const adminService = serviceFactory.getAdminService();
    const result = await adminService.updateReportStatus(id, status);

    if (!result.success) {
      return apiServiceErr(result, 500);
    }

    return apiOk(result.data);
  } catch (error: unknown) {
    logger.error({ error }, 'Error updating report');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

export const DELETE = withAdmin(async (request: NextRequest, context) => {
  try {
    const rawId = context.params['id'];
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) {
      return apiErr('validation_error', 'Report id is required', 400);
    }

    const adminService = serviceFactory.getAdminService();
    const result = await adminService.deleteReport(id);

    if (!result.success) {
      return apiServiceErr(result, 500);
    }

    return apiOk(null, 200, { meta: { message: 'Report deleted successfully' } });
  } catch (error: unknown) {
    logger.error({ error }, 'Error deleting report');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
