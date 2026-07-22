import { describe, expect, it } from 'vitest';
import { toAdminSubscriptionsListViewModel } from '@/features/admin/subscriptions/mappers/admin-subscriptions.mapper';

describe('toAdminSubscriptionsListViewModel', () => {
  it('maps admin subscriptions to display-safe view models', () => {
    const result = toAdminSubscriptionsListViewModel({
      subscriptions: [
        {
          id: 'sub-1',
          user: 'user-1',
          userEmail: 'learner@example.com',
          plan: { id: 'monthly', name: 'Monthly' },
          amount: 50000,
          currency: 'VND',
          status: 'pending',
          payosOrderId: 'order-1',
          endDate: '2026-08-02T00:00:00.000Z',
          isActive: false,
          createdAt: '2026-07-02T00:00:00.000Z',
          updatedAt: '2026-07-02T01:00:00.000Z',
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

    expect(result.subscriptions[0]).toMatchObject({
      id: 'sub-1',
      userId: 'user-1',
      plan: { id: 'monthly', name: 'Monthly' },
      amountLabel: '50.000 ₫',
      payosTransactionIdLabel: '—',
      startDateLabel: '—',
      endDateLabel: '07:00 02/08/2026',
    });
    expect(result.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
    expect(result.subscriptions[0]).not.toHaveProperty('startDate');
    expect(result.subscriptions[0]).not.toHaveProperty('payosTransactionId');
    expect(result.subscriptions[0]).not.toHaveProperty('payosPaymentUrl');
  });
});
