import { createHash } from 'node:crypto';
import { withAuth } from '@/lib/api/auth';
import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { askRinAgentRequestSchema } from '@/dtos/ask-rin-chan';
import { parseJsonBody } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (request, { userId, session }) => {
  const parsed = await parseJsonBody(request, askRinAgentRequestSchema);
  if (!parsed.ok) return parsed.response;

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
