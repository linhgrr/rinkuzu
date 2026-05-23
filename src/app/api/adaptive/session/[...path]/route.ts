import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

export const GET = withAuth<{ path: string[] }>(async (req, { params, userId, session }) => {
  const { path } = params;
  return proxyAdaptiveRequest(req, `/api/session/${path.join('/')}`, {
    userId,
    userRole: session.user.role,
  });
});

export const POST = withAuth<{ path: string[] }>(async (req, { params, userId, session }) => {
  const { path } = params;
  return proxyAdaptiveRequest(
    req,
    `/api/session/${path.join('/')}`,
    { userId, userRole: session.user.role },
    { method: 'POST' },
  );
});
