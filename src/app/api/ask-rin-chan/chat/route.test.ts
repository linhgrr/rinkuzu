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
  exerciseContextToken: 'x'.repeat(32),
  message: 'Giải thích bước này',
  clientRequestId: 'request-1234',
};

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/ask-rin-chan/chat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': 'request-1234',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ask-rin-chan/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
    proxyAdaptiveRequestMock.mockResolvedValue(new Response(null, { status: 200 }));
  });

  it('requires login and validates the shared chat contract', async () => {
    expect(dynamic).toBe('force-dynamic');
    authMock.mockResolvedValueOnce(null);
    expect((await POST(request(validBody), routeContext)).status).toBe(401);

    const invalid = await POST(request({ ...validBody, message: '' }), routeContext);
    expect(invalid.status).toBe(400);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });

  it('meters one Ask Rin-chan capability and enables durable response replay', async () => {
    const incoming = request(validBody);
    const response = await POST(incoming, routeContext);

    expect(response.status).toBe(200);
    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      incoming,
      '/ask-rin-chan/chat',
      { userId: 'user-1', userRole: 'user' },
      {
        method: 'POST',
        body: JSON.stringify(validBody),
        contentType: 'application/json',
        llmAction: 'ask_rin_chan',
        allowCommittedReplay: true,
        timeoutMs: 180_000,
      },
    );
  });
});
