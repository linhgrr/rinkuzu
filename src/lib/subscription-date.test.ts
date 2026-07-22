import { describe, expect, it } from 'vitest';
import { isActiveSubscriptionPremium, isSubscriptionExpired } from '@/lib/subscription-date';

const now = new Date('2026-07-01T00:00:00.000Z');

describe('isSubscriptionExpired', () => {
  it('leaves missing end dates for anomaly handling instead of expiring them', () => {
    expect(isSubscriptionExpired({}, now)).toBe(false);
    expect(isSubscriptionExpired({ endDate: null }, now)).toBe(false);
  });

  it('expires subscriptions at their exact end time', () => {
    expect(isSubscriptionExpired({ endDate: '2026-07-01T00:00:00.000Z' }, now)).toBe(true);
    expect(isSubscriptionExpired({ endDate: new Date('2026-06-30T23:59:59.999Z') }, now)).toBe(
      true,
    );
  });

  it('keeps subscriptions active before their end time', () => {
    expect(isSubscriptionExpired({ endDate: '2026-07-01T00:00:00.001Z' }, now)).toBe(false);
  });

  it('fails closed for malformed persisted end dates', () => {
    expect(isSubscriptionExpired({ endDate: 'not-a-date' }, now)).toBe(true);
  });
});

describe('isActiveSubscriptionPremium', () => {
  it('returns true only for active subscriptions with a valid future endDate', () => {
    expect(
      isActiveSubscriptionPremium({ isActive: true, endDate: '2026-07-01T00:00:00.001Z' }, now),
    ).toBe(true);
    expect(
      isActiveSubscriptionPremium(
        { isActive: true, endDate: new Date('2099-01-01T00:00:00.000Z') },
        now,
      ),
    ).toBe(true);
  });

  it('returns false when inactive even if endDate is in the future', () => {
    expect(
      isActiveSubscriptionPremium({ isActive: false, endDate: '2099-01-01T00:00:00.000Z' }, now),
    ).toBe(false);
    expect(
      isActiveSubscriptionPremium({ isActive: null, endDate: '2099-01-01T00:00:00.000Z' }, now),
    ).toBe(false);
    expect(
      isActiveSubscriptionPremium(
        { isActive: undefined, endDate: '2099-01-01T00:00:00.000Z' },
        now,
      ),
    ).toBe(false);
  });

  it('returns false at the exact end instant and after expiry', () => {
    expect(
      isActiveSubscriptionPremium({ isActive: true, endDate: '2026-07-01T00:00:00.000Z' }, now),
    ).toBe(false);
    expect(
      isActiveSubscriptionPremium(
        { isActive: true, endDate: new Date('2026-06-30T23:59:59.999Z') },
        now,
      ),
    ).toBe(false);
  });

  it('fails closed for missing, null, or invalid endDate', () => {
    expect(isActiveSubscriptionPremium({ isActive: true }, now)).toBe(false);
    expect(isActiveSubscriptionPremium({ isActive: true, endDate: null }, now)).toBe(false);
    expect(isActiveSubscriptionPremium({ isActive: true, endDate: undefined }, now)).toBe(false);
    expect(isActiveSubscriptionPremium({ isActive: true, endDate: 'not-a-date' }, now)).toBe(false);
    expect(isActiveSubscriptionPremium(null, now)).toBe(false);
    expect(isActiveSubscriptionPremium(undefined, now)).toBe(false);
  });
});
