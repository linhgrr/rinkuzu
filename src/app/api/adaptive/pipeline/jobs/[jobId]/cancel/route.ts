import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { invalidateAdaptiveServiceCache } from '@/lib/adaptive/cache-policy';
import { withAuth } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

export const POST = withAuth<{ jobId: string }>(async (req, { params, userId, session }) => {
  const { jobId } = params;
  const res = await proxyAdaptiveRequest(
    req,
    `/api/pipeline/jobs/${jobId}/cancel`,
    { userId, userRole: session.user.role },
    { method: 'POST', timeoutMs: 25_000 },
  );
  invalidateAdaptiveServiceCache();
  return res;
});
