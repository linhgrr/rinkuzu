import { beforeEach, describe, expect, it, vi } from 'vitest';

const isUserPremium = vi.fn();

vi.mock('@/lib/entitlement-factory', () => ({
  createEntitlementService: () => ({ isUserPremium }),
}));

import { can, getConstraint, getMeteredWindows, resolveEntitlements } from './index';

describe('entitlements registry', () => {
  it('grants the curated Premium catalog to paid accounts only', () => {
    expect(can({ tier: 'premium' }, 'premium_catalog')).toBe(true);
    expect(can({ tier: 'free' }, 'premium_catalog')).toBe(false);
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
  });

  it('maps premium status to the premium tier', async () => {
    isUserPremium.mockResolvedValue(true);
    expect(await resolveEntitlements('user-1')).toEqual({ tier: 'premium' });
  });

  it('fails closed to free when premium lookup throws', async () => {
    isUserPremium.mockRejectedValue(new Error('db down'));
    expect(await resolveEntitlements('user-1')).toEqual({ tier: 'free' });
  });

  it('reads the projection on every call so a grant is visible immediately', async () => {
    isUserPremium.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect(await resolveEntitlements('user-1')).toEqual({ tier: 'free' });
    expect(await resolveEntitlements('user-1')).toEqual({ tier: 'premium' });
    expect(isUserPremium).toHaveBeenCalledTimes(2);
  });

  it('does not remember a failed lookup as a free tier', async () => {
    isUserPremium.mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce(true);
    expect(await resolveEntitlements('user-1')).toEqual({ tier: 'free' });
    // A paying user must not stay locked out because one read failed.
    expect(await resolveEntitlements('user-1')).toEqual({ tier: 'premium' });
  });
});
