import { createHash } from 'node:crypto';
import { withAuth } from '@/lib/api/auth';
import { apiErr } from '@/lib/api/response';
import { readAndValidateJson } from '@/lib/api/request';
import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { askRinAgentRequestSchema } from '@/dtos/ask-rin-chan';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (request, { userId, session }) => {
  const parsed = await readAndValidateJson(request, askRinAgentRequestSchema);
  if (!parsed.success) {
    return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
  }

  const headers = new Headers(request.headers);
  const idempotencyKey = createHash('sha256').update(parsed.data.runId, 'utf8').digest('base64url');
  headers.set('Idempotency-Key', idempotencyKey);
  const meteredRequest = new Request(request.url, {
    method: 'POST',
    headers,
    signal: request.signal,
  });

  return proxyAdaptiveRequest(
    meteredRequest,
    '/ask-rin-chan/agent',
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
