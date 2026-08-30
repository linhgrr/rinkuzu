import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';
import { adaptivePipelineJobsQuerySchema } from '@/dtos/adaptive-pipeline';
import { parseSearchParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, { userId, session }) => {
  const query = parseSearchParams(req, adaptivePipelineJobsQuerySchema);
  if (!query.ok) return query.response;
  return proxyAdaptiveRequest(
    req,
    `/pipeline/jobs?limit=${query.data.limit}`,
    { userId, userRole: session.user.role },
    { timeoutMs: 25_000 },
  );
});
