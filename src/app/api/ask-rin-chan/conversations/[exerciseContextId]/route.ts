import { withAuth } from '@/lib/api/auth';
import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { askRinConversationPathSchema } from '@/dtos/ask-rin-chan';
import { parseRouteParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

const handle = (method: 'GET' | 'DELETE') =>
  withAuth(async (request, { params, userId, session }) => {
    const parsed = parseRouteParams(params, askRinConversationPathSchema);
    if (!parsed.ok) return parsed.response;
    const contextId = encodeURIComponent(parsed.data.exerciseContextId);
    return proxyAdaptiveRequest(
      request,
      `/ask-rin-chan/conversations/${contextId}`,
      { userId, userRole: session.user.role },
      { method },
    );
  });

export const GET = handle('GET');
export const DELETE = handle('DELETE');
