import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAdmin } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

export const PATCH = withAdmin<{ keyId: string }>(async (req, { params, userId, session }) =>
  proxyAdaptiveRequest(req, `/admin/ocr-keys/${encodeURIComponent(params.keyId)}`, {
    userId,
    userRole: session.user.role,
  }),
);

export const DELETE = withAdmin<{ keyId: string }>(async (req, { params, userId, session }) =>
  proxyAdaptiveRequest(req, `/admin/ocr-keys/${encodeURIComponent(params.keyId)}`, {
    userId,
    userRole: session.user.role,
  }),
);
