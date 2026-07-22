import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (request, { userId, session }) =>
  proxyAdaptiveRequest(
    request,
    '/quiz/drafts/manual',
    { userId, userRole: session.user.role },
    { method: 'POST' },
  ),
);
