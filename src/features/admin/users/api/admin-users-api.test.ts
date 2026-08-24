import { afterEach, describe, expect, it, vi } from 'vitest';

const { fetchApiDataMock } = vi.hoisted(() => ({
  fetchApiDataMock: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  fetchApiData: fetchApiDataMock,
}));

import {
  fetchAdminUserListViewModel,
  grantAdminUserCredits,
  grantAdminUserSubscription,
  updateAdminUserRole,
  updateAdminUserStatus,
} from '@/features/admin/users/api/admin-users-api';

describe('admin-users-api', () => {
  afterEach(() => {
    fetchApiDataMock.mockReset();
  });

  it('lists users through the admin users transport and maps the view model', async () => {
    fetchApiDataMock.mockResolvedValue({
      users: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });

    await fetchAdminUserListViewModel('/api/admin/users?page=1&limit=10&status=all');
    expect(fetchApiDataMock).toHaveBeenCalledWith('/api/admin/users?page=1&limit=10&status=all');
  });

  it('PATCHes role on /api/admin/users with exact method and body', async () => {
    fetchApiDataMock.mockResolvedValue({ message: 'ok' });

    await expect(
      updateAdminUserRole({ userId: '507f191e810c19729de860ea', role: 'admin' }),
    ).resolves.toEqual({ message: 'ok' });

    expect(fetchApiDataMock).toHaveBeenCalledWith('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '507f191e810c19729de860ea', role: 'admin' }),
    });
  });

  it('PATCHes status on /api/admin/users/:id/status with exact path, method, body, and response', async () => {
    const statusResponse = {
      id: '507f191e810c19729de860ea',
      disable: 1,
      changed: true,
      disabledAt: '2026-07-18T00:00:00.000Z',
      message: 'User disabled',
    };
    fetchApiDataMock.mockResolvedValue(statusResponse);

    await expect(
      updateAdminUserStatus({ userId: '507f191e810c19729de860ea', disable: 1 }),
    ).resolves.toEqual(statusResponse);

    expect(fetchApiDataMock).toHaveBeenCalledWith(
      '/api/admin/users/507f191e810c19729de860ea/status',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disable: 1 }),
      },
    );
  });

  it('POSTs subscription grant on /api/admin/users with exact method and body', async () => {
    fetchApiDataMock.mockResolvedValue({ message: 'granted' });

    await grantAdminUserSubscription({
      userId: '507f191e810c19729de860ea',
      planId: 'plan-1',
    });

    expect(fetchApiDataMock).toHaveBeenCalledWith('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '507f191e810c19729de860ea', planId: 'plan-1' }),
    });
  });

  it('POSTs an idempotent credit grant to the selected user', async () => {
    const result = {
      userId: '507f191e810c19729de860ea',
      amount: 5,
      balance: 12,
      ledgerEntryId: '507f191e810c19729de860eb',
      alreadyApplied: false,
    };
    fetchApiDataMock.mockResolvedValue(result);

    await expect(
      grantAdminUserCredits({
        userId: result.userId,
        amount: 5,
        note: 'Verified contribution',
        idempotencyKey: '0aa7c561-a366-4abf-81ec-fb90e64c237c',
      }),
    ).resolves.toEqual(result);
    expect(fetchApiDataMock).toHaveBeenCalledWith(
      '/api/admin/users/507f191e810c19729de860ea/credits',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 5,
          note: 'Verified contribution',
          idempotencyKey: '0aa7c561-a366-4abf-81ec-fb90e64c237c',
        }),
      },
    );
  });
});
