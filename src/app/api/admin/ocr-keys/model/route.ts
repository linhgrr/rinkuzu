import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAdmin } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

const proxyOcrModelRequest = withAdmin(async (req, { userId, session }) =>
  proxyAdaptiveRequest(req, '/admin/ocr-keys/model', {
    userId,
    userRole: session.user.role,
  }),
);

export const GET = proxyOcrModelRequest;
export const PATCH = proxyOcrModelRequest;
