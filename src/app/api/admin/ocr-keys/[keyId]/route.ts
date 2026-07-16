import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAdmin } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

const proxyOcrKeyRequest = withAdmin<{ keyId: string }>(async (req, { params, userId, session }) =>
  proxyAdaptiveRequest(req, `/admin/ocr-keys/${encodeURIComponent(params.keyId)}`, {
    userId,
    userRole: session.user.role,
  }),
);

export const PATCH = proxyOcrKeyRequest;
export const DELETE = proxyOcrKeyRequest;
