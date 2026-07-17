import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, proxyAdaptiveRequestMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  proxyAdaptiveRequestMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/adaptive/proxy', () => ({
  proxyAdaptiveRequest: proxyAdaptiveRequestMock,
}));

import { dynamic, GET, POST } from '@/app/api/adaptive/session/[...path]/route';

const USER_ID = 'user-1';

function session(overrides?: { id?: string; role?: string }) {
  return {
    user: {
      id: overrides?.id ?? USER_ID,
      email: 'user@example.com',
      role: overrides?.role ?? 'user',
    },
  };
}

function getRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost/api/adaptive/session/${path}`);
}

function postRequest(path: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/adaptive/session/${path}`, {
    method: 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function context(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

describe('/api/adaptive/session/[...path]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    proxyAdaptiveRequestMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
  });

  it('exports force-dynamic and requires authentication for GET and POST', async () => {
    expect(dynamic).toBe('force-dynamic');
    authMock.mockResolvedValue(null);

    const getResponse = await GET(getRequest('sess-1/status'), context(['sess-1', 'status']));
    const postResponse = await POST(postRequest('sess-1/step'), context(['sess-1', 'step']));

    expect(getResponse.status).toBe(401);
    expect(postResponse.status).toBe(401);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });

  it('rejects invalid GET path params without proxying', async () => {
    const response = await GET(getRequest('sess-1/unknown'), context(['sess-1', 'unknown']));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });

  it('proxies GET status with authenticated user context', async () => {
    authMock.mockResolvedValue(session({ role: 'admin' }));

    await GET(getRequest('sess-abc/status'), context(['sess-abc', 'status']));

    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/session/sess-abc/status',
      { userId: USER_ID, userRole: 'admin' },
    );
  });

  it('maps concept GET paths to concept/{conceptId} upstream suffixes', async () => {
    await GET(getRequest('sess-1/concept/c-9'), context(['sess-1', 'concept', 'c-9']));

    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/session/sess-1/concept/c-9',
      { userId: USER_ID, userRole: 'user' },
    );
  });

  it.each(['theory', 'graph', 'mastery-matrix'] as const)(
    'proxies GET %s action paths without rewriting',
    async (action) => {
      await GET(getRequest(`sess-1/${action}`), context(['sess-1', action]));

      expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
        expect.any(NextRequest),
        `/session/sess-1/${action}`,
        { userId: USER_ID, userRole: 'user' },
      );
    },
  );

  it('rejects invalid POST path params without proxying', async () => {
    const response = await POST(postRequest('sess-1/bad'), context(['sess-1', 'bad']));

    expect(response.status).toBe(400);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });

  it('proxies body-less POST exercise/step/next-concept with adaptive_generation llmAction', async () => {
    for (const action of ['exercise', 'step', 'next-concept'] as const) {
      proxyAdaptiveRequestMock.mockClear();
      await POST(postRequest(`sess-1/${action}`), context(['sess-1', action]));

      expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
        expect.any(NextRequest),
        `/session/sess-1/${action}`,
        { userId: USER_ID, userRole: 'user' },
        {
          method: 'POST',
          llmAction: 'adaptive_generation',
        },
      );
    }
  });

  it('validates submit body and forwards JSON with adaptive_generation llmAction', async () => {
    const submitBody = {
      exercise_id: 'ex-1',
      idempotency_key: 'idem-1',
      answer: { choice: 'A' },
    };

    await POST(postRequest('sess-1/submit', submitBody), context(['sess-1', 'submit']));

    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/session/sess-1/submit',
      { userId: USER_ID, userRole: 'user' },
      {
        method: 'POST',
        llmAction: 'adaptive_generation',
        body: JSON.stringify(submitBody),
        contentType: 'application/json',
      },
    );
  });

  it('rejects invalid submit bodies before proxying', async () => {
    const response = await POST(
      postRequest('sess-1/submit', { exercise_id: '', answer: {} }),
      context(['sess-1', 'submit']),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('validation_error');
    expect(body.error.meta?.fields).toBeDefined();
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });

  it('validates chat body and uses adaptive_tutor_chat llmAction', async () => {
    const chatBody = {
      userQuestion: 'Explain derivatives',
      chatHistory: [{ role: 'user' as const, content: 'hi' }],
      stream: true,
    };

    await POST(postRequest('sess-1/chat', chatBody), context(['sess-1', 'chat']));

    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/session/sess-1/chat',
      { userId: USER_ID, userRole: 'user' },
      {
        method: 'POST',
        llmAction: 'adaptive_tutor_chat',
        body: JSON.stringify(chatBody),
        contentType: 'application/json',
      },
    );
  });

  it('rejects invalid chat bodies and never maps them to the tutor llmAction', async () => {
    const response = await POST(
      postRequest('sess-1/chat', { userQuestion: '' }),
      context(['sess-1', 'chat']),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });
});
