import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ recordActivationClick: vi.fn() }));

vi.mock('@/lib/communication/activation-nudge', () => ({
  recordActivationClick: mocks.recordActivationClick,
}));

import { GET } from './route';

const STARTER =
  'https://www.rinkuzu.app/en/quiz/en-starter?entry=activation_email&utm_source=email&utm_campaign=activation_nudge';

function click(query: string) {
  // Opened from a mail client: signed out, no Origin.
  return new NextRequest(`https://www.rinkuzu.app/api/email/activation-click${query}`);
}

describe('GET /api/email/activation-click (RIN-1000)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordActivationClick.mockResolvedValue(STARTER);
  });

  it('records the click with the token and locale, then 302s to the starter quiz', async () => {
    const response = await GET(click('?t=6a8ed209f04328ac17443d91.abc.sig&l=en'));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(STARTER);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.recordActivationClick).toHaveBeenCalledWith(
      '6a8ed209f04328ac17443d91.abc.sig',
      'en',
    );
  });

  it('passes a missing or oversized token on as empty, and still redirects', async () => {
    await GET(click(''));
    const oversized = await GET(click(`?t=${'a'.repeat(300)}&l=${'x'.repeat(20)}`));

    expect(oversized.status).toBe(302);
    expect(mocks.recordActivationClick).toHaveBeenNthCalledWith(1, '', null);
    expect(mocks.recordActivationClick).toHaveBeenNthCalledWith(2, '', null);
  });
});
