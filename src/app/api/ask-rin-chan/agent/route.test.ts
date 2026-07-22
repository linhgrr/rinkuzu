import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, proxyAdaptiveRequestMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  proxyAdaptiveRequestMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/adaptive/proxy', () => ({ proxyAdaptiveRequest: proxyAdaptiveRequestMock }));

import { dynamic, POST } from './route';

const routeContext = { params: Promise.resolve({}) };
const validBody = {
  threadId: 'quiz:question-hash',
  runId: 'Ab3xYz9',
  state: null,
  messages: [{ id: 'message-1', role: 'user', content: 'Giải thích giúp mình' }],
  tools: [],
  context: [],
  forwardedProps: { exerciseContextToken: 'x'.repeat(32) },
};

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/ask-rin-chan/agent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ask-rin-chan/agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
    proxyAdaptiveRequestMock.mockResolvedValue(new Response(null, { status: 200 }));
  });

  it('requires login and rejects unsupported AG-UI tools', async () => {
    expect(dynamic).toBe('force-dynamic');
    authMock.mockResolvedValueOnce(null);
    expect((await POST(request(validBody), routeContext)).status).toBe(401);

    const invalid = await POST(
      request({ ...validBody, tools: [{ name: 'unsafe', description: '', parameters: {} }] }),
      routeContext,
    );
    expect(invalid.status).toBe(400);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });

  it('accepts the seven-character assistant-ui run id and meters its safe digest', async () => {
    const response = await POST(request(validBody), routeContext);

    expect(response.status).toBe(200);
    expect(proxyAdaptiveRequestMock).toHaveBeenCalledOnce();
    const [meteredRequest, target, auth, options] = proxyAdaptiveRequestMock.mock.calls[0] ?? [];
    expect(meteredRequest.headers.get('idempotency-key')).toBe(
      createHash('sha256').update(validBody.runId, 'utf8').digest('base64url'),
    );
    expect(target).toBe('/ask-rin-chan/agent');
    expect(auth).toEqual({ userId: 'user-1', userRole: 'user' });
    expect(options).toEqual({
      method: 'POST',
      body: JSON.stringify(validBody),
      contentType: 'application/json',
      llmAction: 'ask_rin_chan',
      allowCommittedReplay: true,
      timeoutMs: 180_000,
    });
  });
});
