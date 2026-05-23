import { proxyAdaptiveRequest } from '@/lib/adaptive-learning/proxy';
import { withAuth } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

export const GET = withAuth<{ jobId: string }>(async (req, { params, userId, session }) => {
  const { jobId } = params;
  return proxyAdaptiveRequest(
    req,
    `/api/pipeline/jobs/${jobId}`,
    { userId, userRole: session.user.role },
    { timeoutMs: 25_000 },
  );
});
