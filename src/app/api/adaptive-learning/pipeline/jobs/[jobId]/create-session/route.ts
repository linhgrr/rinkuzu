import { proxyAdaptiveRequest } from '@/lib/adaptive-learning/proxy';
import { withAuth } from '@/lib/api/auth';
import { invalidateAdaptiveServiceCache } from '@/lib/adaptive-learning/cache-policy';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ jobId: string }>(async (req, { params, userId, session }) => {
  const { jobId } = params;
  const response = await proxyAdaptiveRequest(
    req,
    `/api/pipeline/jobs/${jobId}/create-session`,
    { userId, userRole: session.user.role },
    {
      method: 'POST',
      timeoutMs: 30_000,
    },
  );

  invalidateAdaptiveServiceCache();
  return response;
});
