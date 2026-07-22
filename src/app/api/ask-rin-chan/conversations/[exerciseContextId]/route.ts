import { withAuth } from '@/lib/api/auth';
import { apiErr } from '@/lib/api/response';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { askRinConversationPathSchema } from '@/dtos/ask-rin-chan';

export const dynamic = 'force-dynamic';

const handle = (method: 'GET' | 'DELETE') =>
  withAuth(async (request, { params, userId, session }) => {
    const parsed = readAndValidateRouteParams(params, askRinConversationPathSchema);
    if (!parsed.success) {
      return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
    }
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
