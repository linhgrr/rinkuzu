import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';
import { apiErr } from '@/lib/api/response';
import { readAndValidateSearchParams } from '@/lib/api/request';
import { adaptivePipelineJobQuerySchema } from '@/dtos/adaptive-pipeline';
import { readAdaptiveJobRouteParams } from './job-route-params';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, { params, userId, session }) => {
  const jobParams = readAdaptiveJobRouteParams(params);
  if (!jobParams.success) return jobParams.response;

  const query = readAndValidateSearchParams(req, adaptivePipelineJobQuerySchema);
  if (!query.success) {
    return apiErr('validation_error', query.error, 400, { fields: query.fields });
  }

  const debugQuery = query.data.include_debug ? '?include_debug=true' : '';

  return proxyAdaptiveRequest(
    req,
    `/pipeline/jobs/${jobParams.jobId}${debugQuery}`,
    { userId, userRole: session.user.role },
    { timeoutMs: 25_000 },
  );
});
