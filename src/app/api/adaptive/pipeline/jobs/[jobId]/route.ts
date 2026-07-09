import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';
import { apiErr } from '@/lib/api/response';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { adaptivePipelineJobRouteParamsSchema } from '@/dtos/adaptive-pipeline';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, { params, userId, session }) => {
  const parsedParams = readAndValidateRouteParams(params, adaptivePipelineJobRouteParamsSchema);
  if (!parsedParams.success) {
    return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
  }

  return proxyAdaptiveRequest(
    req,
    `/pipeline/jobs/${parsedParams.data.jobId}`,
    { userId, userRole: session.user.role },
    { timeoutMs: 25_000 },
  );
});
