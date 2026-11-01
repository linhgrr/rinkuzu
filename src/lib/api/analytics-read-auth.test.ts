import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

import { hasValidAnalyticsReadToken } from './analytics-read-auth';

const TOKEN = 'fake-analytics-token-0123456789abcdef';

function request(authorization?: string): NextRequest {
  return new NextRequest('http://localhost/api/admin/stats/activation', {
    headers: authorization === undefined ? {} : { authorization },
  });
}

describe('hasValidAnalyticsReadToken', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts the configured token as a bearer credential', () => {
    vi.stubEnv('ANALYTICS_READ_TOKEN', TOKEN);
    expect(hasValidAnalyticsReadToken(request(`Bearer ${TOKEN}`))).toBe(true);
    expect(hasValidAnalyticsReadToken(request(`bearer ${TOKEN}`))).toBe(true);
  });

  it('rejects a missing, malformed or wrong credential', () => {
    vi.stubEnv('ANALYTICS_READ_TOKEN', TOKEN);
    expect(hasValidAnalyticsReadToken(request())).toBe(false);
    expect(hasValidAnalyticsReadToken(request(TOKEN))).toBe(false);
    expect(hasValidAnalyticsReadToken(request('Bearer '))).toBe(false);
    expect(hasValidAnalyticsReadToken(request(`Bearer ${TOKEN}x`))).toBe(false);
    expect(hasValidAnalyticsReadToken(request(`Bearer ${TOKEN.slice(0, -1)}`))).toBe(false);
    expect(hasValidAnalyticsReadToken(request(`Basic ${TOKEN}`))).toBe(false);
  });

  it('is disabled when the env var is unset or empty, even for an empty bearer', () => {
    vi.stubEnv('ANALYTICS_READ_TOKEN', '');
    expect(hasValidAnalyticsReadToken(request('Bearer '))).toBe(false);
    expect(hasValidAnalyticsReadToken(request('Bearer x'))).toBe(false);
    vi.stubEnv('ANALYTICS_READ_TOKEN', '   ');
    expect(hasValidAnalyticsReadToken(request('Bearer    '))).toBe(false);
    vi.stubEnv('ANALYTICS_READ_TOKEN', undefined);
    expect(hasValidAnalyticsReadToken(request(`Bearer ${TOKEN}`))).toBe(false);
  });
});
