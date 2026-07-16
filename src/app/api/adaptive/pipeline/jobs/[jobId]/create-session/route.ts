import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';
import { invalidateAdaptiveServiceCache } from '@/lib/adaptive/cache-policy';
import { apiErr } from '@/lib/api/response';
import { readAndValidateSearchParams } from '@/lib/api/request';
import { adaptivePipelineSessionCreateQuerySchema } from '@/dtos/adaptive-pipeline';
import { readAdaptiveJobRouteParams } from '../job-route-params';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req, { params, userId, session }) => {
  const jobParams = readAdaptiveJobRouteParams(params);
  if (!jobParams.success) return jobParams.response;

  const query = readAndValidateSearchParams(req, adaptivePipelineSessionCreateQuerySchema);
  if (!query.success) {
    return apiErr('validation_error', query.error, 400, { fields: query.fields });
  }

  const response = await proxyAdaptiveRequest(
    req,
    `/pipeline/jobs/${jobParams.jobId}/create-session?max_steps=${query.data.max_steps}`,
    { userId, userRole: session.user.role },
    {
      method: 'POST',
      llmAction: 'adaptive_generation',
      timeoutMs: 30_000,
    },
  );

  invalidateAdaptiveServiceCache();
  return response;
});
