import type { Session } from 'next-auth';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));

vi.mock('@/auth', () => ({ auth: authMock }));

import { withAdmin, withAuth, withLlmConfigAdmin, withOptionalAuth } from '@/lib/api/auth';

function createSession(role: 'admin' | 'user' = 'user'): Session {
  return {
    expires: new Date(Date.now() + 60_000).toISOString(),
    user: {
      id: 'user-1',
      email: 'user@example.com',
      role,
    },
  };
}

const request = new NextRequest('http://localhost/api/test');

describe('API auth wrappers', () => {
  beforeEach(() => {
    authMock.mockReset();
  });

  it('returns 401 without invoking the protected handler when no session exists', async () => {
    authMock.mockResolvedValue(null);
    const handler = vi.fn(async () => new Response(null, { status: 204 }));

    const response = await withAuth(handler)(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'unauthorized', message: 'Unauthorized' },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 401 when the session user is missing id or email', async () => {
    const handler = vi.fn(async () => new Response(null, { status: 204 }));

    authMock.mockResolvedValue({
      expires: new Date(Date.now() + 60_000).toISOString(),
      user: { email: 'user@example.com', role: 'user' },
    } as Session);
    const missingId = await withAuth(handler)(request, { params: Promise.resolve({}) });
    expect(missingId.status).toBe(401);

    authMock.mockResolvedValue({
      expires: new Date(Date.now() + 60_000).toISOString(),
      user: { id: 'user-1', role: 'user' },
    } as Session);
    const missingEmail = await withAuth(handler)(request, { params: Promise.resolve({}) });
    expect(missingEmail.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('passes the authenticated identity and resolved route params to the handler', async () => {
    const session = createSession();
    authMock.mockResolvedValue(session);
    const handler = vi.fn(async () => new Response(null, { status: 204 }));

    const response = await withAuth<{ quizId: string }>(handler)(request, {
      params: Promise.resolve({ quizId: 'quiz-1' }),
    });

    expect(response.status).toBe(204);
    expect(handler).toHaveBeenCalledWith(request, {
      userId: 'user-1',
      email: 'user@example.com',
      session,
      params: { quizId: 'quiz-1' },
    });
  });

  it('preserves the role guard before invoking the protected handler', async () => {
    authMock.mockResolvedValue(createSession('user'));
    const handler = vi.fn(async () => new Response(null, { status: 204 }));

    const response = await withAuth(handler, { role: 'admin' })(request, {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'forbidden', detail: 'Admin access required' },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('uses the raw role label for non-admin role requirements', async () => {
    authMock.mockResolvedValue(createSession('user'));
    const handler = vi.fn(async () => new Response(null, { status: 204 }));

    const response = await withAuth(handler, { role: 'moderator' })(request, {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { detail: 'moderator access required' },
    });
  });

  it('allows matching roles and withAdmin convenience wrapper', async () => {
    authMock.mockResolvedValue(createSession('admin'));
    const handler = vi.fn(async () => new Response(null, { status: 204 }));

    await expect(
      withAuth(handler, { role: 'admin' })(request, { params: Promise.resolve({}) }),
    ).resolves.toMatchObject({ status: 204 });
    await expect(
      withAdmin(handler)(request, { params: Promise.resolve({}) }),
    ).resolves.toMatchObject({
      status: 204,
    });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('requires strict same-origin JSON for LLM configuration mutations', async () => {
    authMock.mockResolvedValue(createSession('admin'));
    const handler = vi.fn(async () => new Response(null, { status: 204 }));
    const secureRequest = new NextRequest('http://localhost/api/admin/ai-settings/providers', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost',
        'sec-fetch-site': 'same-origin',
      },
      body: '{}',
    });

    await expect(
      withLlmConfigAdmin(handler)(secureRequest, { params: Promise.resolve({}) }),
    ).resolves.toMatchObject({ status: 204 });

    const crossSite = new NextRequest(secureRequest, {
      headers: {
        'content-type': 'application/json',
        origin: 'https://evil.example',
        'sec-fetch-site': 'cross-site',
      },
    });
    await expect(
      withLlmConfigAdmin(handler)(crossSite, { params: Promise.resolve({}) }),
    ).resolves.toMatchObject({ status: 403 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('passes null identity fields to an optional-auth handler for anonymous requests', async () => {
    authMock.mockResolvedValue(null);
    const handler = vi.fn(async () => new Response(null, { status: 204 }));

    const response = await withOptionalAuth<{ slug: string }>(handler)(request, {
      params: Promise.resolve({ slug: 'public-quiz' }),
    });

    expect(response.status).toBe(204);
    expect(handler).toHaveBeenCalledWith(request, {
      userId: null,
      email: null,
      session: null,
      params: { slug: 'public-quiz' },
    });
  });

  it('projects optional-auth identity from a partial session user', async () => {
    const session = createSession('user');
    authMock.mockResolvedValue(session);
    const handler = vi.fn(async () => new Response(null, { status: 204 }));

    await withOptionalAuth(handler)(request, { params: Promise.resolve({}) });

    expect(handler).toHaveBeenCalledWith(request, {
      userId: 'user-1',
      email: 'user@example.com',
      session,
      params: {},
    });
  });
});
