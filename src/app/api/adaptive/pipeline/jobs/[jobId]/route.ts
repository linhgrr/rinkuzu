import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { settlePipelineUsageFromResponse } from '@/lib/adaptive/pipeline-usage';
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
  const auth = { userId, userRole: session.user.role };

  const response = await proxyAdaptiveRequest(
    req,
    `/pipeline/jobs/${jobParams.data.jobId}${debugQuery}`,
    auth,
    { timeoutMs: 25_000 },
  );
  // Failed jobs hand their adaptive_pipeline unit back (RIN-589).
  await settlePipelineUsageFromResponse(response, auth);
  return response;
});
