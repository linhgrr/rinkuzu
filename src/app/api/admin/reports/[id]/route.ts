import { getAdminService } from '@/lib/admin-factory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { readAndValidateJson } from '@/lib/api/request';
import { updateAdminReportRequestSchema } from '@/dtos/admin-report';
import { createAdminReportIdRoute } from './report-id-route';

export const dynamic = 'force-dynamic';

export const PATCH = createAdminReportIdRoute({
  logMessage: 'Error updating report',
  publicErrorMessage: 'Internal server error',
  handle: async ({ request, id, email }) => {
    const input = await readAndValidateJson(request, updateAdminReportRequestSchema);
    if (!input.success) {
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    }

    const adminService = getAdminService();
    const result = await adminService.updateReportStatus(id, input.data, email);

    if (!result.success) {
      return apiServiceErr(result);
    }

    return apiOk(result.data);
  },
});

export const DELETE = createAdminReportIdRoute({
  logMessage: 'Error deleting report',
  publicErrorMessage: 'Internal server error',
  handle: async ({ id }) => {
    const adminService = getAdminService();
    const result = await adminService.deleteReport(id);

    if (!result.success) {
      return apiServiceErr(result);
    }

    return apiOk(result.data, 200, { meta: { message: 'Report deleted successfully' } });
  },
});
