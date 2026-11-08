import { describe, expect, it } from 'vitest';
import { sanitizedGetRequest } from './sanitized-request';

describe('sanitizedGetRequest', () => {
  it('keeps only the given params and drops undefined ones', () => {
    const original = new Request('https://app.test/api/x?evil=1&window=7d', {
      method: 'GET',
      headers: { 'x-request-id': 'req-1' },
    });

    const sanitized = sanitizedGetRequest(original, {
      window: '30d',
      limit: 25,
      cursor: undefined,
    });

    const url = new URL(sanitized.url);
    expect(url.pathname).toBe('/api/x');
    expect(url.searchParams.toString()).toBe('window=30d&limit=25');
    expect(sanitized.method).toBe('GET');
    expect(sanitized.headers.get('x-request-id')).toBe('req-1');
  });
});
