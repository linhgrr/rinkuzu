import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, { userId, session }) =>
  proxyAdaptiveRequest(req, '/history/subjects', {
    userId,
    userRole: session.user.role,
  }),
);
