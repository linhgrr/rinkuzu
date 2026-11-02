import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, proxyAdaptiveRequestMock, settleBeforeDeleteMock, settleFromResponseMock } =
  vi.hoisted(() => ({
    authMock: vi.fn(),
    proxyAdaptiveRequestMock: vi.fn(),
    settleBeforeDeleteMock: vi.fn(),
    settleFromResponseMock: vi.fn(),
  }));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/adaptive/proxy', () => ({ proxyAdaptiveRequest: proxyAdaptiveRequestMock }));
vi.mock('@/lib/quiz/draft-usage', () => ({
  settleQuizDraftUsageBeforeDelete: settleBeforeDeleteMock,
  settleQuizDraftUsageFromResponse: settleFromResponseMock,
}));

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

  it('settles quiz_extract usage from a single-draft read', async () => {
    const upstream = new Response('draft');
    proxyAdaptiveRequestMock.mockResolvedValue(upstream);

    const response = await createQuizDraftIdRoute()(request, routeContext);

    expect(response).toBe(upstream);
    expect(settleFromResponseMock).toHaveBeenCalledWith(upstream, {
      userId: 'user-1',
      userRole: 'user',
    });
    expect(settleBeforeDeleteMock).not.toHaveBeenCalled();
  });

  it('settles the draft before deleting it, so a failed draft keeps its refund', async () => {
    const order: string[] = [];
    settleBeforeDeleteMock.mockImplementation(async () => order.push('settle'));
    proxyAdaptiveRequestMock.mockImplementation(async () => {
      order.push('delete');
      return new Response('ok');
    });

    await createQuizDraftIdRoute({ method: 'DELETE' })(request, routeContext);

    expect(settleBeforeDeleteMock).toHaveBeenCalledWith('507f1f77bcf86cd799439011', {
      userId: 'user-1',
      userRole: 'user',
    });
    expect(order).toEqual(['settle', 'delete']);
    expect(settleFromResponseMock).not.toHaveBeenCalled();
  });

  it('does not settle on PATCH', async () => {
    await createQuizDraftIdRoute({ method: 'PATCH' })(request, routeContext);

    expect(settleBeforeDeleteMock).not.toHaveBeenCalled();
    expect(settleFromResponseMock).not.toHaveBeenCalled();
  });
});
