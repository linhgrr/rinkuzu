import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';
import { apiErr } from '@/lib/api/response';
import { readAndValidateRouteParams, readAndValidateSearchParams } from '@/lib/api/request';
import {
  adaptivePipelineJobQuerySchema,
  adaptivePipelineJobRouteParamsSchema,
} from '@/dtos/adaptive-pipeline';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, { params, userId, session }) => {
  const parsedParams = readAndValidateRouteParams(params, adaptivePipelineJobRouteParamsSchema);
  if (!parsedParams.success) {
    return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
  }

  const query = readAndValidateSearchParams(req, adaptivePipelineJobQuerySchema);
  if (!query.success) {
    return apiErr('validation_error', query.error, 400, { fields: query.fields });
  }

  const debugQuery = query.data.include_debug ? '?include_debug=true' : '';

  return proxyAdaptiveRequest(
    req,
    `/pipeline/jobs/${parsedParams.data.jobId}${debugQuery}`,
    { userId, userRole: session.user.role },
    { timeoutMs: 25_000 },
  );
});
