import { describe, expect, it } from 'vitest';

import { assertTrustedPayosCheckoutUrl } from './trusted-navigation';

describe('trusted PayOS checkout URLs', () => {
  it('accepts official PayOS checkout origins over https', () => {
    expect(assertTrustedPayosCheckoutUrl('https://pay.payos.vn/web/123')).toBe(
      'https://pay.payos.vn/web/123',
    );
    expect(assertTrustedPayosCheckoutUrl('https://next.pay.payos.vn/web/123')).toBe(
      'https://next.pay.payos.vn/web/123',
    );
  });

  it('throws when a checkout URL is not trusted', () => {
    expect(() => assertTrustedPayosCheckoutUrl('http://pay.payos.vn/web/123')).toThrow(
      'Received an invalid payment redirect URL',
    );
    expect(() => assertTrustedPayosCheckoutUrl('https://pay.example/checkout')).toThrow(
      'Received an invalid payment redirect URL',
    );
    expect(() => assertTrustedPayosCheckoutUrl('/relative/path')).toThrow(
      'Received an invalid payment redirect URL',
    );
    expect(() => assertTrustedPayosCheckoutUrl('https://evil.example/checkout')).toThrow(
      'Received an invalid payment redirect URL',
    );
  });
});
