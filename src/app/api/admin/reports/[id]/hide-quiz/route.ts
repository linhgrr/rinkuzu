import { hideReportedQuizRequestSchema } from '@/dtos/admin-report';
import { getAdminReportModerationService } from '@/lib/admin-factory';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { parseJsonBody } from '@/lib/api/validated';
import { createAdminReportIdRoute } from '../report-id-route';

export const dynamic = 'force-dynamic';

// POST /api/admin/reports/[id]/hide-quiz - Hide the reported quiz (audited) and resolve the report.
export const POST = createAdminReportIdRoute({
  logMessage: 'Error hiding reported quiz',
  publicErrorMessage: 'Internal server error',
  handle: async ({ request, id, userId, email }) => {
    const input = await parseJsonBody(request, hideReportedQuizRequestSchema);
    if (!input.ok) return input.response;

    const result = await getAdminReportModerationService().hideReportedQuiz(
      id,
      { id: userId, email },
      input.data.adminNotes,
    );
    return result.success ? apiOk(result.data) : apiServiceErr(result);
  },
});
