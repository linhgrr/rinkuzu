import { proxyAdaptiveRequest } from '@/lib/adaptive-learning/proxy';
import { withAuth } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, { userId, session }) =>
  proxyAdaptiveRequest(req, '/api/history/subjects', {
    userId,
    userRole: session.user.role,
  }),
);
