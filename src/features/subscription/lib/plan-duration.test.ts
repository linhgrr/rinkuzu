import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import enPricing from '../../../../messages/en/pricing.json';
import viPricing from '../../../../messages/vi/pricing.json';
import { formatPlanDuration } from './plan-duration';

// RIN-1015: the vi plan cards showed "1 Month" / "6 Months" from the plan
// catalogue's English displayName. The duration now comes from i18n.
describe('formatPlanDuration', () => {
  const en = createTranslator({
    locale: 'en',
    messages: { pricing: enPricing },
    namespace: 'pricing',
  });
  const vi = createTranslator({
    locale: 'vi',
    messages: { pricing: viPricing },
    namespace: 'pricing',
  });

  it('formats English durations with the right plural', () => {
    expect(formatPlanDuration(en, 1)).toBe('1 month');
    expect(formatPlanDuration(en, 6)).toBe('6 months');
  });

  it('formats Vietnamese durations without any English', () => {
    expect(formatPlanDuration(vi, 1)).toBe('1 tháng');
    expect(formatPlanDuration(vi, 6)).toBe('6 tháng');
  });
});
