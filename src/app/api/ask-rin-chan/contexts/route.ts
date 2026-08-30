import { withAuth } from '@/lib/api/auth';
import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { askRinContextRequestSchema } from '@/dtos/ask-rin-chan';
import { parseJsonBody } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (request, { userId, session }) => {
  const parsed = await parseJsonBody(request, askRinContextRequestSchema);
  if (!parsed.ok) return parsed.response;

  return proxyAdaptiveRequest(
    request,
    '/ask-rin-chan/contexts',
    {
      userId,
      userRole: session.user.role,
    },
    {
      method: 'POST',
      body: JSON.stringify(parsed.data),
      contentType: 'application/json',
    },
  );
});
