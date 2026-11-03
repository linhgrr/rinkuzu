import { describe, expect, it } from 'vitest';
import { toAdminUserListViewModel } from '@/features/admin/users/mappers/admin-users.mapper';

describe('toAdminUserListViewModel', () => {
  it('maps admin users to display-safe view models', () => {
    const result = toAdminUserListViewModel({
      users: [
        {
          id: 'user-1',
          email: 'learner@example.com',
          role: 'user',
          disable: 0,
          isTestAccount: false,
          createdAt: '2026-07-02T00:00:00.000Z',
          subscription: {
            plan: { id: 'premium', name: 'Premium' },
            startDate: '2026-07-02T00:00:00.000Z',
            isActive: true,
          },
        },
      ],
      pagination: {
        currentPage: 2,
        totalPages: 4,
        totalItems: 35,
        itemsPerPage: 10,
        hasNextPage: true,
        hasPrevPage: true,
      },
    });

    expect(result.users[0]).toMatchObject({
      id: 'user-1',
      disable: 0,
      accountStatusLabel: 'accountActive',
      accountStatusVariant: 'success',
      isTestAccount: false,
      createdAtLabel: '07/02/2026',
      subscription: {
        startDateLabel: '07/02/2026',
        statusLabel: 'active',
        statusVariant: 'success',
      },
    });
    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 35,
      totalPages: 4,
    });
    expect(result.users[0]).not.toHaveProperty('displayName');
    expect(result.users[0]?.subscription).not.toHaveProperty('endDate');
    expect(result.users[0]?.subscription).not.toHaveProperty('endDateLabel');
  });

  it('carries the admin-set test-account flag through to the row', () => {
    const result = toAdminUserListViewModel({
      users: [
        {
          id: 'user-2',
          email: 'qa-bot@example.com',
          role: 'user',
          disable: 0,
          isTestAccount: true,
          createdAt: '2026-07-02T00:00:00.000Z',
        },
      ],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 1,
        itemsPerPage: 10,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });

    expect(result.users[0]?.isTestAccount).toBe(true);
  });
});
