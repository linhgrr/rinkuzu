import { describe, expect, it } from 'vitest';
import { toProfileSettingsViewModel } from '@/features/profile/mappers/profile-settings.mapper';

describe('toProfileSettingsViewModel', () => {
  it('maps account profile DTO to profile settings view model', () => {
    expect(
      toProfileSettingsViewModel(
        {
          email: 'learner@example.com',
          displayName: 'Learner',
          bio: 'Bio',
          avatar: 'https://example.com/avatar.png',
          role: 'user',
          createdAt: '2026-07-02T00:00:00.000Z',
          subscription: {
            plan: { id: 'premium', name: 'Premium' },
            isActive: true,
            startDate: '2026-07-01T00:00:00.000Z',
            endDate: '2026-08-01T00:00:00.000Z',
            payosOrderId: 'order-1',
            payosTransactionId: 'tx-1',
          },
        },
        'en',
      ),
    ).toEqual({
      email: 'learner@example.com',
      displayName: 'Learner',
      bio: 'Bio',
      avatar: 'https://example.com/avatar.png',
      role: 'user',
      createdAt: '2026-07-02T00:00:00.000Z',
      createdAtLabel: 'Jul 2, 2026',
      subscription: {
        plan: { id: 'premium', name: 'Premium' },
        isActive: true,
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2026-08-01T00:00:00.000Z',
        payosOrderId: 'order-1',
        payosTransactionId: 'tx-1',
      },
    });
  });

  it('omits absent optional profile and subscription fields', () => {
    const result = toProfileSettingsViewModel(
      {
        email: 'learner@example.com',
        role: 'user',
        createdAt: '2026-07-02T00:00:00.000Z',
        subscription: { plan: { id: 'premium-p1m', name: 'Premium' }, isActive: true },
      },
      'en',
    );

    expect(result).not.toHaveProperty('displayName');
    expect(result).not.toHaveProperty('bio');
    expect(result).not.toHaveProperty('avatar');
    expect(result.subscription).toEqual({
      plan: { id: 'premium-p1m', name: 'Premium' },
      isActive: true,
    });
  });
});

describe('toProfileSettingsViewModel hasPassword (RIN-1017)', () => {
  const base = {
    email: 'learner@example.com',
    role: 'user',
    createdAt: '2026-07-02T00:00:00.000Z',
  } as const;

  it('keeps hasPassword false for a Google-only account', () => {
    expect(toProfileSettingsViewModel({ ...base, hasPassword: false }, 'en').hasPassword).toBe(
      false,
    );
  });

  it('omits hasPassword when the API does not send it', () => {
    expect(toProfileSettingsViewModel(base, 'en')).not.toHaveProperty('hasPassword');
  });
});

describe('toProfileSettingsViewModel member-since label', () => {
  // 18:30Z on 1 Nov is already 2 Nov in Asia/Ho_Chi_Minh, the zone every label is pinned to.
  const profile = {
    email: 'learner@example.com',
    role: 'user',
    createdAt: '2026-11-01T18:30:00.000Z',
  } as const;

  it('reads day-first in Vietnamese', () => {
    expect(toProfileSettingsViewModel(profile, 'vi').createdAtLabel).toBe('02/11/2026');
  });

  it('spells the month out in English so the day and month cannot be swapped', () => {
    expect(toProfileSettingsViewModel(profile, 'en').createdAtLabel).toBe('Nov 2, 2026');
  });
});
