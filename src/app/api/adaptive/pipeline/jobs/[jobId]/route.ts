import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';
import {
  adaptivePipelineJobQuerySchema,
  adaptivePipelineJobRouteParamsSchema,
} from '@/dtos/adaptive-pipeline';
import { parseRouteParams, parseSearchParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, { params, userId, session }) => {
  const jobParams = parseRouteParams(params, adaptivePipelineJobRouteParamsSchema);
  if (!jobParams.ok) return jobParams.response;

  const query = parseSearchParams(req, adaptivePipelineJobQuerySchema);
  if (!query.ok) return query.response;

  const debugQuery = query.data.include_debug ? '?include_debug=true' : '';

  return proxyAdaptiveRequest(
    req,
    `/pipeline/jobs/${jobParams.data.jobId}${debugQuery}`,
    { userId, userRole: session.user.role },
    { timeoutMs: 25_000 },
  );
});
