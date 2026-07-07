import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAdmin } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

// Proxies to the adaptive service's admin usage aggregation. Query params
// (e.g. ?window=30d) are forwarded automatically by proxyAdaptiveRequest.
export const GET = withAdmin(async (req, { userId, session }) =>
  proxyAdaptiveRequest(req, '/admin/llm-usage/summary', {
    userId,
    userRole: session.user.role,
  }),
);
