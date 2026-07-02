import { describe, expect, it } from 'vitest';
import { isSubscriptionExpired } from '@/lib/subscription-date';

const now = new Date('2026-07-01T00:00:00.000Z');

describe('isSubscriptionExpired', () => {
  it('treats a missing end date as a lifetime subscription', () => {
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
