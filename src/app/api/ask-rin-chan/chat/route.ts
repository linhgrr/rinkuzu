import { withAuth } from '@/lib/api/auth';
import { apiErr } from '@/lib/api/response';
import { readAndValidateJson } from '@/lib/api/request';
import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { askRinChatRequestSchema } from '@/dtos/ask-rin-chan';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (request, { userId, session }) => {
  const parsed = await readAndValidateJson(request, askRinChatRequestSchema);
  if (!parsed.success) {
    return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
  }

  return proxyAdaptiveRequest(
    request,
    '/ask-rin-chan/chat',
    { userId, userRole: session.user.role },
    {
      method: 'POST',
      body: JSON.stringify(parsed.data),
      contentType: 'application/json',
      llmAction: 'ask_rin_chan',
      allowCommittedReplay: true,
      timeoutMs: 180_000,
    },
  );
});
