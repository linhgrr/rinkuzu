import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ headers: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: state.headers }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn() } }));

import { captureAnonymousServerEvent, captureServerEvent } from './server';

const env = { NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'phc_test' };

function requestWith(userAgent: string | null) {
  state.headers.mockResolvedValue(new Headers(userAgent ? { 'user-agent': userAgent } : {}));
}

describe('server analytics: agent traffic (RIN-1760)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
  });

  it('skips a capture made while handling an agent request', async () => {
    requestWith('Mozilla/5.0 Chrome/130 rinkuzu-agent/qa');

    expect(await captureServerEvent('activation_email_clicked', 'u1', { locale: 'en' }, env)).toBe(
      false,
    );
    expect(await captureAnonymousServerEvent('checkout_started_server', { plan: 'p' }, env)).toBe(
      false,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends for a learner request', async () => {
    requestWith('Mozilla/5.0 Chrome/130 Safari/537.36');

    expect(await captureServerEvent('activation_email_clicked', 'u1', { locale: 'en' }, env)).toBe(
      true,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends outside a request scope (cron, email sends)', async () => {
    state.headers.mockRejectedValue(new Error('headers() called outside a request scope'));

    expect(await captureServerEvent('activation_email_sent', 'u1', { locale: 'en' }, env)).toBe(
      true,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
