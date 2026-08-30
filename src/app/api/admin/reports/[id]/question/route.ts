import { getAdminService } from '@/lib/admin-factory';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { updateAdminReportedQuestionRequestSchema } from '@/dtos/admin-report';
import { createAdminReportIdRoute } from '../report-id-route';
import { parseJsonBody } from '@/lib/api/validated';

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
    const input = await parseJsonBody(request, updateAdminReportedQuestionRequestSchema);
    if (!input.ok) return input.response;

    const result = await getAdminService().updateReportedQuestion(id, input.data);
    return result.success ? apiOk(result.data) : apiServiceErr(result);
  },
});
