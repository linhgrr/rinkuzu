import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, proxyAdaptiveRequestMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  proxyAdaptiveRequestMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/adaptive/proxy', () => ({ proxyAdaptiveRequest: proxyAdaptiveRequestMock }));

import { createQuizDraftIdRoute } from '@/app/api/quiz-drafts/[id]/draft-id-route';

const request = new NextRequest('http://localhost/api/quiz-drafts/507f1f77bcf86cd799439011');
const routeContext = { params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }) };

describe('createQuizDraftIdRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
    proxyAdaptiveRequestMock.mockResolvedValue(new Response('ok'));
  });

  it('validates the draft id before proxying', async () => {
    const route = createQuizDraftIdRoute();

    const response = await route(request, { params: Promise.resolve({ id: 'bad/id' }) });

    expect(response.status).toBe(400);
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });

  it.each([
    ['GET', undefined],
    ['PATCH', { method: 'PATCH' }],
    ['DELETE', { method: 'DELETE' }],
  ] as const)('forwards %s through the shared auth context', async (method, options) => {
    const route = createQuizDraftIdRoute(options);

    await route(request, routeContext);

    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      request,
      '/quiz/drafts/507f1f77bcf86cd799439011',
      { userId: 'user-1', userRole: 'user' },
      ...(options ? [options] : []),
    );
  });
});
