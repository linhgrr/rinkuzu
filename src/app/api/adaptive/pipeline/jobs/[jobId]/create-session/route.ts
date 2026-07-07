import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';
import { invalidateAdaptiveServiceCache } from '@/lib/adaptive/cache-policy';
import { apiErr } from '@/lib/api/response';
import { readAndValidateRouteParams, readAndValidateSearchParams } from '@/lib/api/request';
import {
  adaptivePipelineJobRouteParamsSchema,
  adaptivePipelineSessionCreateQuerySchema,
} from '@/dtos/adaptive-pipeline';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req, { params, userId, session }) => {
  const parsedParams = readAndValidateRouteParams(params, adaptivePipelineJobRouteParamsSchema);
  if (!parsedParams.success) {
    return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
  }
  const query = readAndValidateSearchParams(req, adaptivePipelineSessionCreateQuerySchema);
  if (!query.success) {
    return apiErr('validation_error', query.error, 400, { fields: query.fields });
  }

  const response = await proxyAdaptiveRequest(
    req,
    `/api/pipeline/jobs/${parsedParams.data.jobId}/create-session?max_steps=${query.data.max_steps}`,
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
