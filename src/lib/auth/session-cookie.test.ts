import { describe, expect, it } from 'vitest';

import { isRscOrPrefetchRequest, usesSecureAuthCookie } from './session-cookie';

function request(headers: HeadersInit): Request {
  return new Request('http://localhost/en/dashboard', { headers });
}

describe('session cookie refresh guard', () => {
  it.each([
    ['rsc', '1'],
    ['next-router-prefetch', '1'],
    ['purpose', 'prefetch'],
  ])('recognises %s requests', (name, value) => {
    expect(isRscOrPrefetchRequest(request({ [name]: value }))).toBe(true);
  });

  it('does not classify ordinary document requests as prefetches', () => {
    expect(isRscOrPrefetchRequest(request({}))).toBe(false);
  });

  it('recognises Next.js RSC query requests even when middleware strips RSC headers', () => {
    expect(isRscOrPrefetchRequest(new Request('http://localhost/en/dashboard?_rsc=abc'))).toBe(
      true,
    );
  });

  it('recognises the Next Router state header used by RSC fetches', () => {
    expect(
      isRscOrPrefetchRequest(request({ 'next-router-state-tree': '%5B%22%22%2C%7B%7D%5D' })),
    ).toBe(true);
  });

  it('recognises the fallback fetch signature used when Next strips internal headers', () => {
    expect(
      isRscOrPrefetchRequest(
        request({ accept: '*/*', 'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors' }),
      ),
    ).toBe(true);
  });

  it('uses secure cookies for direct and reverse-proxied HTTPS requests', () => {
    expect(usesSecureAuthCookie(new Request('https://example.com/en/dashboard'))).toBe(true);
    expect(
      usesSecureAuthCookie(
        new Request('http://internal/en/dashboard', {
          headers: { 'x-forwarded-proto': 'https, http' },
        }),
      ),
    ).toBe(true);
    expect(usesSecureAuthCookie(new Request('http://localhost/en/dashboard'))).toBe(false);
  });
});
