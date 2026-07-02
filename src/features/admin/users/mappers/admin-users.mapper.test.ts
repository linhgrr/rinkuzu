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
          createdAt: '2026-07-02T00:00:00.000Z',
          subscription: {
            type: 'premium',
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
  });
});
