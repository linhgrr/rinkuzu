import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { proxyMock } = vi.hoisted(() => ({ proxyMock: vi.fn() }));
vi.mock('@/lib/adaptive/proxy', () => ({ proxyAdaptiveRequest: proxyMock }));
vi.mock('@/lib/api/auth', () => ({
  withLlmConfigAdmin:
    (handler: (...args: unknown[]) => unknown) =>
    (request: Request, context: { params: Promise<Record<string, string>> }) =>
      context.params.then((params) =>
        handler(request, {
          params,
          userId: 'admin-1',
          session: { user: { role: 'admin' } },
        }),
      ),
}));

import { createAiSettingsHandler } from './proxy';

describe('AI settings route factory', () => {
  beforeEach(() => {
    proxyMock.mockReset().mockResolvedValue(new Response('{}', { status: 200 }));
  });

  it('uses the exact encoded fixed path, forwards If-Match explicitly, and forces no-store', async () => {
    const handler = createAiSettingsHandler<{ providerId: string }>({
      method: 'PATCH',
      path: ({ providerId }) => `/admin/llm-settings/providers/${encodeURIComponent(providerId)}`,
      forwardIfMatch: true,
    });
    const request = new NextRequest(
      'https://app.test/api/admin/ai-settings/providers/provider%2Fone',
      {
        method: 'PATCH',
      },
    );

    const response = await handler(request, {
      params: Promise.resolve({ providerId: 'provider/one' }),
    });

    expect(proxyMock).toHaveBeenCalledWith(
      request,
      '/admin/llm-settings/providers/provider%2Fone',
      { userId: 'admin-1', userRole: 'admin' },
      { method: 'PATCH', forwardIfMatch: true },
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
