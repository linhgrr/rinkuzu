import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAdmin } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (req, { userId, session }) =>
  proxyAdaptiveRequest(req, '/admin/ocr-keys', {
    userId,
    userRole: session.user.role,
  }),
);

export const POST = withAdmin(async (req, { userId, session }) =>
  proxyAdaptiveRequest(req, '/admin/ocr-keys', {
    userId,
    userRole: session.user.role,
  }),
);
