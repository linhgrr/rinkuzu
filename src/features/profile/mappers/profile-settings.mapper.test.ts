import { describe, expect, it } from 'vitest';
import { toProfileSettingsViewModel } from '@/features/profile/mappers/profile-settings.mapper';

describe('toProfileSettingsViewModel', () => {
  it('maps account profile DTO to profile settings view model', () => {
    expect(
      toProfileSettingsViewModel({
        email: 'learner@example.com',
        displayName: 'Learner',
        bio: 'Bio',
        avatar: 'https://example.com/avatar.png',
        role: 'user',
        createdAt: '2026-07-02T00:00:00.000Z',
        subscription: {
          type: 'premium',
          isActive: true,
          startDate: '2026-07-01T00:00:00.000Z',
          endDate: '2026-08-01T00:00:00.000Z',
          payosOrderId: 'order-1',
          payosTransactionId: 'tx-1',
        },
      }),
    ).toEqual({
      email: 'learner@example.com',
      displayName: 'Learner',
      bio: 'Bio',
      avatar: 'https://example.com/avatar.png',
      role: 'user',
      createdAt: '2026-07-02T00:00:00.000Z',
      createdAtLabel: '07/02/2026',
      subscription: {
        type: 'premium',
        isActive: true,
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2026-08-01T00:00:00.000Z',
        payosOrderId: 'order-1',
        payosTransactionId: 'tx-1',
      },
    });
  });
});
