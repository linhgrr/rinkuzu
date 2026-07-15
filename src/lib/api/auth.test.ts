import type { Session } from 'next-auth';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));

vi.mock('@/auth', () => ({ auth: authMock }));

import { withAuth, withOptionalAuth } from '@/lib/api/auth';

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
    expect(handler).not.toHaveBeenCalled();
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
});
