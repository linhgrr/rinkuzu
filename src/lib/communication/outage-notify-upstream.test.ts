import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/adaptive/config', () => ({
  buildAdaptiveUrl: (path: string) => `https://api.rinkuzu.test/api${path}`,
  buildAdaptiveServiceHeaders: () => ({ 'x-service-token': 'fake-service-token' }),
  resolveAdaptiveProxyTimeoutMs: () => 5_000,
}));

const { outageNotifyApi, OutageNotifyUpstreamError } = await import('./outage-notify-upstream');

const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('outageNotifyApi', () => {
  it('lists pending rows with the service token', async () => {
    const item = { id: 'row-1', email: 'learner@example.com', locale: 'en' };
    fetchMock.mockResolvedValue(json({ success: true, data: { items: [item] }, meta: null }));

    await expect(outageNotifyApi.pending('2026-11-vercel', 50)).resolves.toEqual([item]);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(
      'https://api.rinkuzu.test/api/internal/outage-notify/pending?campaign=2026-11-vercel&limit=50',
    );
    expect(init?.headers).toMatchObject({ 'x-service-token': 'fake-service-token' });
  });

  it('marks ids sent with a JSON body', async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: { matched: 2, updated: 2 } }));

    await outageNotifyApi.markSent(['row-1', 'row-2']);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.rinkuzu.test/api/internal/outage-notify/mark-sent');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ ids: ['row-1', 'row-2'] }));
    expect(init?.headers).toMatchObject({ 'content-type': 'application/json' });
  });

  it('reads the pending count from stats', async () => {
    fetchMock.mockResolvedValue(
      json({ success: true, data: { total: 9, pending: 4, notified: 5 } }),
    );

    await expect(outageNotifyApi.pendingCount('2026-11-vercel')).resolves.toBe(4);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.rinkuzu.test/api/internal/outage-notify/stats?campaign=2026-11-vercel',
    );
  });

  it.each([
    ['a non-2xx answer', async () => json({ error: 'learner@example.com' }, 401), 'status 401'],
    ['a malformed body', async () => json({ success: true, data: {} }), 'malformed body'],
    [
      'a network failure',
      async () => {
        throw new Error('connect failed');
      },
      'network',
    ],
  ])('throws a step-only error on %s', async (_label, respond, reason) => {
    fetchMock.mockImplementation(respond);

    const error = await outageNotifyApi.pendingCount('2026-11-vercel').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OutageNotifyUpstreamError);
    expect((error as Error).message).toBe(`outage notify stats failed: ${reason}`);
  });
});
