import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

export const GET = withAuth<{ id: string }>(async (req, { params, userId, session }) =>
  proxyAdaptiveRequest(req, `/api/quiz/drafts/${params.id}`, {
    userId,
    userRole: session.user.role,
  }),
);

export const PATCH = withAuth<{ id: string }>(async (req, { params, userId, session }) =>
  proxyAdaptiveRequest(
    req,
    `/api/quiz/drafts/${params.id}`,
    { userId, userRole: session.user.role },
    { method: 'PATCH' },
  ),
);

export const DELETE = withAuth<{ id: string }>(async (req, { params, userId, session }) =>
  proxyAdaptiveRequest(
    req,
    `/api/quiz/drafts/${params.id}`,
    { userId, userRole: session.user.role },
    { method: 'DELETE' },
  ),
);
