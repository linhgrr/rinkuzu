import { describe, expect, it } from 'vitest';
import { isPremiumLimitError } from './limit-error';

describe('isPremiumLimitError', () => {
  it.each(['premium_required', 'llm_rate_limit_exceeded'])('accepts %s', (code) => {
    expect(isPremiumLimitError({ code })).toBe(true);
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
});
