import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkAuthRateLimit: vi.fn(),
  unsubscribeWithToken: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/lib/auth-rate-limit', () => ({
  checkAuthRateLimit: mocks.checkAuthRateLimit,
  rateLimitResponse: () => new Response(null, { status: 429 }),
}));
vi.mock('@/lib/communication/review-reminder', () => ({
  unsubscribeWithToken: mocks.unsubscribeWithToken,
}));
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.loggerError } }));

import { GET, POST } from './route';

const TOKEN = '6a8ed209f04328ac17443d91.study_reminders.sig';
const URL_WITH_TOKEN = `https://www.rinkuzu.app/api/unsubscribe?t=${TOKEN}`;

function post(body: string) {
  // Signed out and cross-site, as a mail provider sends it: no cookie, no Origin.
  return new NextRequest(URL_WITH_TOKEN, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-forwarded-for': '198.51.100.4',
    },
    body,
  });
}

describe('/api/unsubscribe (RFC 8058)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAuthRateLimit.mockResolvedValue({ allowed: true });
    mocks.unsubscribeWithToken.mockResolvedValue(true);
  });

  it('handles a one-click POST: 200, no body, rate-limited per IP', async () => {
    const response = await POST(post('List-Unsubscribe=One-Click'));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    expect(mocks.checkAuthRateLimit).toHaveBeenCalledWith('unsubscribe_ip', '198.51.100.4');
    expect(mocks.unsubscribeWithToken).toHaveBeenCalledWith(TOKEN, '198.51.100.4', null);
  });

  it('passes the activation-nudge campaign through and keeps it on the redirect (RIN-1044)', async () => {
    const request = (body: string) =>
      new NextRequest(`${URL_WITH_TOKEN}&c=activation_nudge`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
      });

    await POST(request('List-Unsubscribe=One-Click'));
    const response = await POST(request('locale=vi'));

    expect(mocks.unsubscribeWithToken).toHaveBeenNthCalledWith(1, TOKEN, null, 'activation_nudge');
    expect(response.headers.get('location')).toBe(
      `https://www.rinkuzu.app/vi/unsubscribe?t=${TOKEN}&c=activation_nudge`,
    );
  });

  it('records no campaign for a review link or an unknown one', async () => {
    await POST(post('List-Unsubscribe=One-Click'));
    await POST(
      new NextRequest(`${URL_WITH_TOKEN}&c=promotions`, {
        method: 'POST',
        body: 'List-Unsubscribe=One-Click',
      }),
    );

    expect(mocks.unsubscribeWithToken).toHaveBeenNthCalledWith(1, TOKEN, '198.51.100.4', null);
    expect(mocks.unsubscribeWithToken).toHaveBeenNthCalledWith(2, TOKEN, null, null);
  });

  it('answers a tampered token exactly like a valid one', async () => {
    mocks.unsubscribeWithToken.mockResolvedValue(false);

    const response = await POST(post('List-Unsubscribe=One-Click'));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
  });

  it('returns 429 when the IP is over its limit and writes nothing', async () => {
    mocks.checkAuthRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });

    const response = await POST(post('List-Unsubscribe=One-Click'));

    expect(response.status).toBe(429);
    expect(mocks.unsubscribeWithToken).not.toHaveBeenCalled();
  });

  it('redirects the confirm-page form back to the localized page', async () => {
    const response = await POST(post('locale=en'));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      `https://www.rinkuzu.app/en/unsubscribe?t=${TOKEN}`,
    );
  });

  it('sends the page to its retry state on a server error, and a provider a 500', async () => {
    mocks.unsubscribeWithToken.mockRejectedValue(new Error('db down'));

    const page = await POST(post('locale=vi'));
    expect(page.status).toBe(303);
    expect(page.headers.get('location')).toBe(
      `https://www.rinkuzu.app/vi/unsubscribe?t=${TOKEN}&result=error`,
    );

    const provider = await POST(post('List-Unsubscribe=One-Click'));
    expect(provider.status).toBe(500);
    expect(JSON.stringify(mocks.loggerError.mock.calls)).not.toContain(TOKEN);
  });

  it('sends a GET to the confirm page without writing', async () => {
    const response = GET(new NextRequest(URL_WITH_TOKEN));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`https://www.rinkuzu.app/unsubscribe?t=${TOKEN}`);
    expect(mocks.unsubscribeWithToken).not.toHaveBeenCalled();
  });
});
