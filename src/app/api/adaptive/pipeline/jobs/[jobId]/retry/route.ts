import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { invalidateAdaptiveServiceCache } from '@/lib/adaptive/cache-policy';
import { withAuth } from '@/lib/api/auth';
import { apiErr } from '@/lib/api/response';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { adaptivePipelineJobRouteParamsSchema } from '@/dtos/adaptive-pipeline';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req, { params, userId, session }) => {
  const parsedParams = readAndValidateRouteParams(params, adaptivePipelineJobRouteParamsSchema);
  if (!parsedParams.success) {
    return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
  }

  const res = await proxyAdaptiveRequest(
    req,
    `/api/pipeline/jobs/${parsedParams.data.jobId}/retry`,
    { userId, userRole: session.user.role },
    { method: 'POST', timeoutMs: 30_000 },
  );
  invalidateAdaptiveServiceCache();
  return res;
});
