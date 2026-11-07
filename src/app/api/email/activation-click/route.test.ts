import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ recordActivationClick: vi.fn() }));

vi.mock('@/lib/communication/activation-nudge', () => ({
  recordActivationClick: mocks.recordActivationClick,
}));

import { GET } from './route';

const STARTER_PATH =
  '/en/quiz/en-starter?entry=activation_email&utm_source=email&utm_campaign=activation_nudge';
const STARTER = `https://127.0.0.1:3000${STARTER_PATH}`;

function click(query: string, origin = 'https://www.rinkuzu.app') {
  // Opened from a mail client: signed out, no Origin.
  return new NextRequest(`${origin}/api/email/activation-click${query}`);
}

describe('GET /api/email/activation-click (RIN-1000)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordActivationClick.mockResolvedValue(STARTER);
  });

  it('records the click with the token and locale, then 302s to the starter quiz', async () => {
    const response = await GET(click('?t=6a8ed209f04328ac17443d91.abc.sig&l=en'));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(STARTER_PATH);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.recordActivationClick).toHaveBeenCalledWith(
      '6a8ed209f04328ac17443d91.abc.sig',
      'en',
    );
  });

  it('redirects by path, so the browser stays on the host the click came in on', async () => {
    // The site URL can name another host than the one serving the click
    // (127.0.0.1 vs localhost, apex vs www): a cross-host hop drops the cookie.
    const response = await GET(click('?t=x&l=en', 'http://localhost:3000'));

    expect(response.headers.get('location')).toBe(STARTER_PATH);
  });

  it('passes a missing or oversized token on as empty, and still redirects', async () => {
    await GET(click(''));
    const oversized = await GET(click(`?t=${'a'.repeat(300)}&l=${'x'.repeat(20)}`));

    expect(oversized.status).toBe(302);
    expect(mocks.recordActivationClick).toHaveBeenNthCalledWith(1, '', null);
    expect(mocks.recordActivationClick).toHaveBeenNthCalledWith(2, '', null);
  });
});
