import { beforeEach, describe, expect, it, vi } from 'vitest';

const isUserPremium = vi.fn();

vi.mock('@/lib/subscription-factory', () => ({
  createSubscriptionService: () => ({ isUserPremium }),
}));

import { can, getLimit, invalidateEntitlements, resolveEntitlements } from './index';

describe('entitlements registry', () => {
  it('grants private_quiz + advanced_stats to premium only', () => {
    expect(can({ tier: 'premium' }, 'private_quiz')).toBe(true);
    expect(can({ tier: 'premium' }, 'advanced_stats')).toBe(true);
    expect(can({ tier: 'free' }, 'private_quiz')).toBe(false);
    expect(can({ tier: 'free' }, 'advanced_stats')).toBe(false);
  });

  it('returns higher metered limits for premium', () => {
    expect(getLimit({ tier: 'free' }, 'quiz_extract', 'day')).toBe(3);
    expect(getLimit({ tier: 'premium' }, 'quiz_extract', 'day')).toBe(30);
  });
});

describe('resolveEntitlements', () => {
  beforeEach(() => {
    isUserPremium.mockReset();
    invalidateEntitlements('user-1');
  });

  it('maps premium status to the premium tier', async () => {
    isUserPremium.mockResolvedValue(true);
    expect(await resolveEntitlements('user-1')).toEqual({ tier: 'premium' });
  });

  it('fails closed to free when premium lookup throws', async () => {
    isUserPremium.mockRejectedValue(new Error('db down'));
    expect(await resolveEntitlements('user-1')).toEqual({ tier: 'free' });
  });

  it('caches the tier within TTL (one lookup for repeated calls)', async () => {
    isUserPremium.mockResolvedValue(true);
    await resolveEntitlements('user-1');
    await resolveEntitlements('user-1');
    expect(isUserPremium).toHaveBeenCalledTimes(1);
  });

  it('re-resolves after invalidation', async () => {
    isUserPremium.mockResolvedValue(true);
    await resolveEntitlements('user-1');
    invalidateEntitlements('user-1');
    await resolveEntitlements('user-1');
    expect(isUserPremium).toHaveBeenCalledTimes(2);
  });
});
