import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, { userId, session }) => {
  const limit = new URL(req.url).searchParams.get('limit') ?? '50';
  return proxyAdaptiveRequest(
    req,
    `/api/pipeline/jobs?limit=${encodeURIComponent(limit)}`,
    { userId, userRole: session.user.role },
    { timeoutMs: 25_000 },
  );
});
