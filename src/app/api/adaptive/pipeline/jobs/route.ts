import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';
import { apiErr } from '@/lib/api/response';
import { adaptivePipelineJobsQuerySchema } from '@/dtos/adaptive-pipeline';
import { readAndValidateSearchParams } from '@/lib/api/request';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, { userId, session }) => {
  const query = readAndValidateSearchParams(req, adaptivePipelineJobsQuerySchema);
  if (!query.success) {
    return apiErr('validation_error', query.error, 400, { fields: query.fields });
  }
  return proxyAdaptiveRequest(
    req,
    `/pipeline/jobs?limit=${query.data.limit}`,
    { userId, userRole: session.user.role },
    { timeoutMs: 25_000 },
  );
});
