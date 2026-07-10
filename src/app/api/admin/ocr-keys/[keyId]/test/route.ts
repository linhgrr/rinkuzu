import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAdmin } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

export const POST = withAdmin<{ keyId: string }>(async (req, { params, userId, session }) =>
  proxyAdaptiveRequest(req, `/admin/ocr-keys/${encodeURIComponent(params.keyId)}/test`, {
    userId,
    userRole: session.user.role,
  }),
);
