import { describe, expect, it } from 'vitest';
import { isStateChangingApiRequest } from './csrf-policy';

describe('CSRF proxy policy', () => {
  it.each([
    '/api/internal/communications/worker',
    '/api/webhooks/resend',
    '/api/auth/callback/credentials',
    '/api/billing/webhooks/payos',
  ])('leaves server-authenticated POST endpoint %s to its route guard', (pathname) => {
    expect(isStateChangingApiRequest(pathname, 'POST')).toBe(false);
  });

  it.each([
    '/api/internal/communications/worker/extra',
    '/api/webhooks/resend-unsafe',
    '/api/support/tickets',
  ])('keeps unrelated POST endpoint %s behind same-origin protection', (pathname) => {
    expect(isStateChangingApiRequest(pathname, 'POST')).toBe(true);
  });

  it('does not CSRF-check read-only or non-API requests', () => {
    expect(isStateChangingApiRequest('/api/support/tickets', 'GET')).toBe(false);
    expect(isStateChangingApiRequest('/support', 'POST')).toBe(false);
  });
});
