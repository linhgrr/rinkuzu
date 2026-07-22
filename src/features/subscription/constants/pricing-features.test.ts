import { describe, expect, it } from 'vitest';
import enPricing from '@/../messages/en/pricing.json';
import viPricing from '@/../messages/vi/pricing.json';
import { APP_MESSAGE_NAMESPACES } from '@/i18n/namespaces';
import { FREE_PRICING_FEATURE_KEYS, PREMIUM_PRICING_FEATURE_KEYS } from './pricing-features';

describe('pricing feature translations', () => {
  it('makes pricing messages available to authenticated app routes', () => {
    expect(APP_MESSAGE_NAMESPACES).toContain('pricing');
  });

  it.each([
    ['en', enPricing],
    ['vi', viPricing],
  ])('defines every feature key for %s', (_locale, messages) => {
    expect(Object.keys(messages.free.features)).toEqual([...FREE_PRICING_FEATURE_KEYS]);
    expect(Object.keys(messages.premium.features)).toEqual([...PREMIUM_PRICING_FEATURE_KEYS]);
    expect(Object.values(messages.free.features).every((value) => value.length > 0)).toBe(true);
    expect(Object.values(messages.premium.features).every((value) => value.length > 0)).toBe(true);
  });
});
