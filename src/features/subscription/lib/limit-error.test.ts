import { describe, expect, it } from 'vitest';
import { isPremiumLimitError } from './limit-error';

describe('isPremiumLimitError', () => {
  it('accepts a premium-required entitlement error', () => {
    expect(isPremiumLimitError({ code: 'premium_required' })).toBe(true);
  });

  it('accepts an explicit upgrade-eligible metadata flag', () => {
    expect(
      isPremiumLimitError({ code: 'rate_limit_exceeded', meta: { upgradeEligible: true } }),
    ).toBe(true);
  });

  it('does not classify unrelated 429 errors as premium limits', () => {
    expect(isPremiumLimitError({ status: 429, code: 'rate_limit_exceeded' })).toBe(false);
    expect(isPremiumLimitError({ status: 429 })).toBe(false);
  });

  it('only classifies quota exhaustion when the server marks it upgrade eligible', () => {
    expect(isPremiumLimitError({ code: 'quota_exceeded', meta: { upgradeEligible: true } })).toBe(
      true,
    );
    expect(isPremiumLimitError({ code: 'quota_exceeded', meta: { upgradeEligible: false } })).toBe(
      false,
    );
    expect(isPremiumLimitError({ code: 'quota_exceeded' })).toBe(false);
  });
});
