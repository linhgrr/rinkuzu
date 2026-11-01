import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

import { withAnalyticsReadOrAdmin } from './analytics-read-auth';

// No session (the mocked `auth()` resolves undefined), so the admin fallback
// answers 401 and only a valid token reaches the handler's 200.
const route = withAnalyticsReadOrAdmin(async (_request, actor) =>
  Response.json({ kind: actor.kind }, { status: 200 }),
);

async function hasValidAnalyticsReadToken(req: NextRequest): Promise<boolean> {
  const response = await route(req, { params: Promise.resolve({}) });
  return response.status === 200;
}

const TOKEN = 'fake-analytics-token-0123456789abcdef';

function request(authorization?: string): NextRequest {
  return new NextRequest('http://localhost/api/admin/stats/activation', {
    headers: authorization === undefined ? {} : { authorization },
  });
}

describe('withAnalyticsReadOrAdmin token access', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts the configured token as a bearer credential', async () => {
    vi.stubEnv('ANALYTICS_READ_TOKEN', TOKEN);
    expect(await hasValidAnalyticsReadToken(request(`Bearer ${TOKEN}`))).toBe(true);
    expect(await hasValidAnalyticsReadToken(request(`bearer ${TOKEN}`))).toBe(true);
  });

  it('rejects a missing, malformed or wrong credential', async () => {
    vi.stubEnv('ANALYTICS_READ_TOKEN', TOKEN);
    expect(await hasValidAnalyticsReadToken(request())).toBe(false);
    expect(await hasValidAnalyticsReadToken(request(TOKEN))).toBe(false);
    expect(await hasValidAnalyticsReadToken(request('Bearer '))).toBe(false);
    expect(await hasValidAnalyticsReadToken(request(`Bearer ${TOKEN}x`))).toBe(false);
    expect(await hasValidAnalyticsReadToken(request(`Bearer ${TOKEN.slice(0, -1)}`))).toBe(false);
    expect(await hasValidAnalyticsReadToken(request(`Basic ${TOKEN}`))).toBe(false);
  });

  it('is disabled when the env var is unset or empty, even for an empty bearer', async () => {
    vi.stubEnv('ANALYTICS_READ_TOKEN', '');
    expect(await hasValidAnalyticsReadToken(request('Bearer '))).toBe(false);
    expect(await hasValidAnalyticsReadToken(request('Bearer x'))).toBe(false);
    vi.stubEnv('ANALYTICS_READ_TOKEN', '   ');
    expect(await hasValidAnalyticsReadToken(request('Bearer    '))).toBe(false);
    vi.stubEnv('ANALYTICS_READ_TOKEN', undefined);
    expect(await hasValidAnalyticsReadToken(request(`Bearer ${TOKEN}`))).toBe(false);
  });
});
