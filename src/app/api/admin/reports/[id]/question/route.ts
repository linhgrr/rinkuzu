import { getAdminService } from '@/lib/admin-factory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { readAndValidateJson } from '@/lib/api/request';
import { updateAdminReportedQuestionRequestSchema } from '@/dtos/admin-report';
import { createAdminReportIdRoute } from '../report-id-route';

export const dynamic = 'force-dynamic';

export const GET = createAdminReportIdRoute({
  logMessage: 'Error getting reported question',
  publicErrorMessage: 'Internal server error',
  handle: async ({ id }) => {
    const result = await getAdminService().getReportedQuestion(id);
    return result.success ? apiOk(result.data) : apiServiceErr(result);
  },
});

export const PATCH = createAdminReportIdRoute({
  logMessage: 'Error updating reported question',
  publicErrorMessage: 'Internal server error',
  handle: async ({ request, id }) => {
    const input = await readAndValidateJson(request, updateAdminReportedQuestionRequestSchema);
    if (!input.success) {
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    }

    const result = await getAdminService().updateReportedQuestion(id, input.data);
    return result.success ? apiOk(result.data) : apiServiceErr(result);
  },
});
