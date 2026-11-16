import { describe, expect, it } from 'vitest';

import { isAgentUserAgent } from '@/shared/constants/agent-traffic';

describe('isAgentUserAgent', () => {
  it('matches the marker anywhere in the User-Agent', () => {
    expect(isAgentUserAgent(`Mozilla/5.0 Chrome/130 rinkuzu-agent/qa`)).toBe(true);
    expect(isAgentUserAgent('rinkuzu-agent/growth')).toBe(true);
  });

  it('does not match learners, crawlers or empty values', () => {
    expect(isAgentUserAgent('Mozilla/5.0 Chrome/130 Safari/537.36')).toBe(false);
    expect(isAgentUserAgent('rinkuzu-agent')).toBe(false);
    expect(isAgentUserAgent('')).toBe(false);
    expect(isAgentUserAgent(null)).toBe(false);
    expect(isAgentUserAgent(undefined)).toBe(false);
  });
});
