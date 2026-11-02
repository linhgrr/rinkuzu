import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { settlePipelineUsageFromResponse } from '@/lib/adaptive/pipeline-usage';
import { withAuth } from '@/lib/api/auth';
import { adaptivePipelineJobsQuerySchema } from '@/dtos/adaptive-pipeline';
import { parseSearchParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, { userId, session }) => {
  const query = parseSearchParams(req, adaptivePipelineJobsQuerySchema);
  if (!query.ok) return query.response;
  const auth = { userId, userRole: session.user.role };
  const response = await proxyAdaptiveRequest(
    req,
    `/pipeline/jobs?limit=${query.data.limit}`,
    auth,
    { timeoutMs: 25_000 },
  );
  // Failed jobs hand their adaptive_pipeline unit back (RIN-589).
  await settlePipelineUsageFromResponse(response, auth);
  return response;
});
