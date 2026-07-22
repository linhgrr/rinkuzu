import { afterEach, describe, expect, it, vi } from 'vitest';

const { fetchApiDataMock } = vi.hoisted(() => ({
  fetchApiDataMock: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  fetchApiData: fetchApiDataMock,
}));

import {
  createAdminBillingPlan,
  deleteAdminBillingPlan,
  fetchAdminBillingPlanViewModels,
  updateAdminBillingPlan,
} from '@/features/admin/plans/api/admin-plans-api';

const planDto = {
  id: 'plan-1',
  name: 'Pro',
  price: 99000,
  duration: 'P1M',
  isActive: true,
  createdAt: '2026-07-02T00:00:00.000Z',
  updatedAt: '2026-07-02T01:00:00.000Z',
};

describe('admin-plans-api', () => {
  afterEach(() => {
    fetchApiDataMock.mockReset();
  });

  it('lists plans with optional abort signal and maps display labels', async () => {
    const signal = new AbortController().signal;
    fetchApiDataMock.mockResolvedValue([planDto]);

    await expect(fetchAdminBillingPlanViewModels(signal)).resolves.toEqual([
      expect.objectContaining({
        id: 'plan-1',
        priceLabel: '99.000 ₫',
        durationLabel: '1 Month',
      }),
    ]);
    expect(fetchApiDataMock).toHaveBeenCalledWith('/api/admin/plans', { signal });

    fetchApiDataMock.mockResolvedValueOnce([]);
    await fetchAdminBillingPlanViewModels();
    expect(fetchApiDataMock).toHaveBeenLastCalledWith('/api/admin/plans', {});
  });

  it('creates, updates, and deletes plans through the admin plans transport', async () => {
    fetchApiDataMock.mockResolvedValue(planDto);
    const createPayload = {
      name: 'Pro',
      price: 99000,
      duration: 'P1M',
      isActive: true,
    };

    await expect(createAdminBillingPlan(createPayload)).resolves.toMatchObject({ id: 'plan-1' });
    expect(fetchApiDataMock).toHaveBeenCalledWith('/api/admin/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createPayload),
    });

    await updateAdminBillingPlan({
      planId: 'plan-1',
      payload: {
        name: 'Pro Plus',
        price: 129000,
        duration: 'P1M',
        isActive: true,
      },
    });
    expect(fetchApiDataMock).toHaveBeenLastCalledWith('/api/admin/plans', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'plan-1',
        name: 'Pro Plus',
        price: 129000,
        duration: 'P1M',
        isActive: true,
      }),
    });

    fetchApiDataMock.mockResolvedValueOnce({ deleted: true });
    await expect(deleteAdminBillingPlan('plan-1')).resolves.toEqual({ deleted: true });
    expect(fetchApiDataMock).toHaveBeenLastCalledWith('/api/admin/plans', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'plan-1' }),
    });
  });
});
