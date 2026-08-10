import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, getConstraintMock, proxyMock, resolveEntitlementsMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getConstraintMock: vi.fn(),
  proxyMock: vi.fn(),
  resolveEntitlementsMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/adaptive/proxy', () => ({ proxyAdaptiveRequest: proxyMock }));
vi.mock('@/lib/entitlements', () => ({
  getConstraint: getConstraintMock,
  resolveEntitlements: resolveEntitlementsMock,
}));

import { POST } from '@/app/api/quiz-drafts/route';

const routeContext = { params: Promise.resolve({}) };

describe('POST /api/quiz-drafts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
    resolveEntitlementsMock.mockResolvedValue({ tier: 'free' });
    getConstraintMock.mockReturnValue(30);
    proxyMock.mockResolvedValue(new Response(null, { status: 200 }));
  });

  it('forwards the trusted quiz page limit with the metered action', async () => {
    const request = new NextRequest('http://localhost/api/quiz-drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Quiz' }),
    });

    const response = await POST(request, routeContext);

    expect(response.status).toBe(200);
    expect(getConstraintMock).toHaveBeenCalledWith({ tier: 'free' }, 'quiz_pdf_pages');
    expect(proxyMock).toHaveBeenCalledWith(
      request,
      '/quiz/drafts',
      { userId: 'user-1', userRole: 'user' },
      {
        method: 'POST',
        llmAction: 'quiz_extract',
        internalHeaders: { 'x-rinkuzu-pdf-page-limit': '30' },
      },
    );
  });
});
