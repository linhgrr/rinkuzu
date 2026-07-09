import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, { userId, session }) =>
  proxyAdaptiveRequest(req, '/quiz/drafts', {
    userId,
    userRole: session.user.role,
  }),
);

export const POST = withAuth(async (req, { userId, session }) =>
  proxyAdaptiveRequest(
    req,
    '/quiz/drafts',
    { userId, userRole: session.user.role },
    { method: 'POST' },
  ),
);
