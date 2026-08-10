import { beforeEach, describe, expect, it, vi } from 'vitest';

const isUserPremium = vi.fn();

vi.mock('@/lib/subscription-factory', () => ({
  createSubscriptionService: () => ({ isUserPremium }),
}));

import { invalidateEntitlements } from './cache';
import { can, getConstraint, getMeteredWindows, resolveEntitlements } from './index';

describe('entitlements registry', () => {
  it('grants private quizzes to premium only', () => {
    expect(can({ tier: 'premium' }, 'private_quiz')).toBe(true);
    expect(can({ tier: 'free' }, 'private_quiz')).toBe(false);
  });

  it('returns the agreed extraction and Ask Rin-chan limits', () => {
    expect(getMeteredWindows({ tier: 'free' }, 'quiz_extract')).toContainEqual({
      window: 'month',
      limit: 5,
    });
    expect(getMeteredWindows({ tier: 'premium' }, 'quiz_extract')).toContainEqual({
      window: 'month',
      limit: 50,
    });
    expect(getMeteredWindows({ tier: 'free' }, 'ask_rin_chan')).toContainEqual({
      window: 'day',
      limit: 25,
    });
    expect(getMeteredWindows({ tier: 'premium' }, 'ask_rin_chan')).toContainEqual({
      window: 'day',
      limit: 150,
    });
  });

  it('does not invent windows that are not configured', () => {
    expect(getMeteredWindows({ tier: 'free' }, 'quiz_extract')).not.toContainEqual({
      window: 'day',
      limit: expect.any(Number),
    });
  });

  it('keeps page-based PDF caps and the shared byte safety ceiling in the registry', () => {
    expect(getConstraint({ tier: 'free' }, 'quiz_pdf_pages')).toBe(30);
    expect(getConstraint({ tier: 'premium' }, 'quiz_pdf_pages')).toBe(100);
    expect(getConstraint({ tier: 'free' }, 'adaptive_pdf_pages')).toBe(30);
    expect(getConstraint({ tier: 'premium' }, 'adaptive_pdf_pages')).toBe(100);
    expect(getConstraint({ tier: 'free' }, 'pdf_upload_bytes')).toBe(100 * 1024 * 1024);
    expect(getConstraint({ tier: 'premium' }, 'pdf_upload_bytes')).toBe(100 * 1024 * 1024);
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
