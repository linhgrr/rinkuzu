import { describe, expect, it } from 'vitest';

import { signupCountryOf, toSignupOrigin } from '@/lib/auth/signup-origin';

describe('signupCountryOf', () => {
  it('keeps an ISO-3166 alpha-2 code from the edge header', () => {
    expect(signupCountryOf('VN')).toBe('VN');
    expect(signupCountryOf('US')).toBe('US');
  });

  it('maps a missing header to null', () => {
    expect(signupCountryOf(null)).toBeNull();
    expect(signupCountryOf(undefined)).toBeNull();
  });

  it('maps the unknown (XX) and Tor (T1) codes to null', () => {
    expect(signupCountryOf('XX')).toBeNull();
    expect(signupCountryOf('T1')).toBeNull();
  });

  it('rejects anything that is not two upper-case letters', () => {
    for (const value of ['', 'vn', 'VNM', 'V1', ' VN', 'Hanoi']) {
      expect(signupCountryOf(value)).toBeNull();
    }
  });
});

describe('toSignupOrigin', () => {
  it('uses the request locale and country', () => {
    expect(toSignupOrigin('en', 'DE')).toEqual({ signupLocale: 'en', signupCountry: 'DE' });
  });

  it('falls back to vi and null when the request says neither', () => {
    expect(toSignupOrigin(null, null)).toEqual({ signupLocale: 'vi', signupCountry: null });
  });
});
