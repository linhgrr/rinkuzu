import { describe, expect, it } from 'vitest';

import { assertTrustedPayosCheckoutUrl, isTrustedPayosCheckoutUrl } from './trusted-navigation';

describe('trusted PayOS checkout URLs', () => {
  it('accepts official PayOS checkout origins over https', () => {
    expect(isTrustedPayosCheckoutUrl('https://pay.payos.vn/web/123')).toBe(true);
    expect(isTrustedPayosCheckoutUrl('https://next.pay.payos.vn/web/123')).toBe(true);
  });

  it('rejects non-https, malformed, and untrusted origins', () => {
    expect(isTrustedPayosCheckoutUrl('http://pay.payos.vn/web/123')).toBe(false);
    expect(isTrustedPayosCheckoutUrl('https://pay.example/checkout')).toBe(false);
    expect(isTrustedPayosCheckoutUrl('/relative/path')).toBe(false);
  });

  it('throws when a checkout URL is not trusted', () => {
    expect(() => assertTrustedPayosCheckoutUrl('https://evil.example/checkout')).toThrow(
      'Received an invalid payment redirect URL',
    );
  });
});
