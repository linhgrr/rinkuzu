import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdminBillingUserNotFoundError,
  BillingPlanConflictError,
  BillingPlanInUseError,
  BillingPlanUnavailableError,
  type AdminSubscriptionRecord,
} from '@/entities/AdminBilling';
import type {
  AdminSubscriptionListOptions,
  CreateBillingPlanData,
  IAdminBillingRepository,
  UpdateBillingPlanData,
} from '@/interfaces/repositories/IAdminBillingRepository';
import { AdminBillingService } from '@/services/admin/AdminBillingService';
import { LIFETIME_END_DATE } from '@/lib/subscription-date';

const { loggerErrorMock } = vi.hoisted(() => ({
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const now = new Date('2026-06-30T10:00:00.000Z');

class AdminBillingRepositoryStub implements IAdminBillingRepository {
  listPlans = vi.fn<() => ReturnType<IAdminBillingRepository['listPlans']>>();
  findPlanById = vi.fn<(planId: string) => ReturnType<IAdminBillingRepository['findPlanById']>>();
  createPlan =
    vi.fn<(data: CreateBillingPlanData) => ReturnType<IAdminBillingRepository['createPlan']>>();
  updatePlan =
    vi.fn<
      (
        planId: string,
        data: UpdateBillingPlanData,
      ) => ReturnType<IAdminBillingRepository['updatePlan']>
    >();
  deletePlan = vi.fn<(planId: string) => ReturnType<IAdminBillingRepository['deletePlan']>>();
  listSubscriptions =
    vi.fn<
      (
        options: AdminSubscriptionListOptions,
      ) => ReturnType<IAdminBillingRepository['listSubscriptions']>
    >();
  findUserById = vi.fn<(userId: string) => ReturnType<IAdminBillingRepository['findUserById']>>();
  addUserSubscriptionGrant =
    vi.fn<
      (
        input: Parameters<IAdminBillingRepository['addUserSubscriptionGrant']>[0],
      ) => ReturnType<IAdminBillingRepository['addUserSubscriptionGrant']>
    >();
}

function plan(overrides = {}) {
  return {
    id: 'premium-p1m',
    name: 'Premium',
    price: 99000,
    duration: 'P1M',
    features: ['AI'],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function subscription(overrides: Partial<AdminSubscriptionRecord> = {}): AdminSubscriptionRecord {
  return {
    id: 'sub-1',
    user: '507f191e810c19729de860ea',
    userEmail: 'user@example.com',
    type: 'premium-p1m',
    amount: 99000,
    currency: 'VND',
    status: 'completed',
    payosOrderId: 'order-1',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('AdminBillingService', () => {
  let repository: AdminBillingRepositoryStub;
  let service: AdminBillingService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.clearAllMocks();
    repository = new AdminBillingRepositoryStub();
    service = new AdminBillingService(repository);
  });

  it('lists plans and maps unexpected failures to 500', async () => {
    repository.listPlans
      .mockResolvedValueOnce([plan()])
      .mockRejectedValueOnce(new Error('db down'));

    await expect(service.listPlans()).resolves.toEqual({
      success: true,
      data: [expect.objectContaining({ id: 'premium-p1m', name: 'Premium' })],
    });

    await expect(service.listPlans()).resolves.toEqual({
      success: false,
      error: 'Internal server error',
      statusCode: 500,
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      { error: expect.any(Error) },
      'Admin get plans error',
    );
  });

  it('creates an immutable plan id and maps plan DTOs', async () => {
    repository.createPlan.mockResolvedValue(plan({ id: 'premium-plan-p1m', name: 'Premium Plan' }));

    const result = await service.createPlan({
      name: 'Premium Plan',
      price: 99000,
      duration: 'P1M',
      features: ['AI'],
      isActive: true,
    });

    expect(repository.createPlan).toHaveBeenCalledWith({
      id: expect.stringMatching(/^plan_[0-9a-f-]{36}$/),
      name: 'Premium Plan',
      price: 99000,
      duration: 'P1M',
      features: ['AI'],
      isActive: true,
    });
    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        id: 'premium-plan-p1m',
        createdAt: now.toISOString(),
      }),
    });
  });

  it('maps duplicate plans to the existing 409 contract', async () => {
    repository.createPlan.mockRejectedValue(new BillingPlanConflictError());

    await expect(
      service.createPlan({
        name: 'Premium',
        price: 99000,
        duration: 'P1M',
        features: [],
        isActive: true,
      }),
    ).resolves.toEqual({
      success: false,
      error: 'A plan with this name and duration already exists',
      statusCode: 409,
    });
  });

  it('maps unexpected create failures to 500', async () => {
    repository.createPlan.mockRejectedValue(new Error('write failed'));

    await expect(
      service.createPlan({
        name: 'Premium',
        price: 99000,
        duration: 'P1M',
        features: [],
        isActive: true,
      }),
    ).resolves.toEqual({
      success: false,
      error: 'Internal server error',
      statusCode: 500,
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      { error: expect.any(Error) },
      'Admin create plan error',
    );
  });

  it('forwards only defined update fields to the repository', async () => {
    repository.updatePlan.mockResolvedValue(plan({ name: 'Pro', price: 120000, isActive: false }));

    await service.updatePlan({
      id: 'premium-p1m',
      name: 'Pro',
      price: 120000,
      duration: 'P3M',
      features: ['AI', 'OCR'],
      isActive: false,
    });

    expect(repository.updatePlan).toHaveBeenCalledWith('premium-p1m', {
      name: 'Pro',
      price: 120000,
      duration: 'P3M',
      features: ['AI', 'OCR'],
      isActive: false,
    });

    repository.updatePlan.mockClear();
    repository.updatePlan.mockResolvedValue(plan({ name: 'Solo' }));

    await service.updatePlan({ id: 'premium-p1m', name: 'Solo' });
    expect(repository.updatePlan).toHaveBeenCalledWith('premium-p1m', { name: 'Solo' });

    repository.updatePlan.mockClear();
    repository.updatePlan.mockResolvedValue(plan({ price: 1 }));
    await service.updatePlan({ id: 'premium-p1m', price: 1 });
    expect(repository.updatePlan).toHaveBeenCalledWith('premium-p1m', { price: 1 });

    repository.updatePlan.mockClear();
    repository.updatePlan.mockResolvedValue(plan({ duration: 'P1Y' }));
    await service.updatePlan({ id: 'premium-p1m', duration: 'P1Y' });
    expect(repository.updatePlan).toHaveBeenCalledWith('premium-p1m', { duration: 'P1Y' });

    repository.updatePlan.mockClear();
    repository.updatePlan.mockResolvedValue(plan({ features: [] }));
    await service.updatePlan({ id: 'premium-p1m', features: [] });
    expect(repository.updatePlan).toHaveBeenCalledWith('premium-p1m', { features: [] });

    repository.updatePlan.mockClear();
    repository.updatePlan.mockResolvedValue(plan({ isActive: false }));
    await service.updatePlan({ id: 'premium-p1m', isActive: false });
    expect(repository.updatePlan).toHaveBeenCalledWith('premium-p1m', { isActive: false });
  });

  it('updates and deletes plans through repository ports', async () => {
    repository.updatePlan.mockResolvedValueOnce(null).mockResolvedValueOnce(plan({ name: 'Pro' }));
    repository.deletePlan.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(service.updatePlan({ id: 'missing', name: 'Pro' })).resolves.toEqual({
      success: false,
      error: 'Plan not found',
      statusCode: 404,
    });
    await expect(service.updatePlan({ id: 'premium-p1m', name: 'Pro' })).resolves.toEqual({
      success: true,
      data: expect.objectContaining({ name: 'Pro' }),
    });
    await expect(service.deletePlan('missing')).resolves.toEqual({
      success: false,
      error: 'Plan not found',
      statusCode: 404,
    });
    await expect(service.deletePlan('premium-p1m')).resolves.toEqual({
      success: true,
      data: { id: 'premium-p1m', deleted: true },
    });
  });

  it('maps unexpected update and delete failures to 500', async () => {
    repository.updatePlan.mockRejectedValueOnce(new Error('update failed'));
    repository.deletePlan.mockRejectedValueOnce(new Error('delete failed'));

    await expect(service.updatePlan({ id: 'premium-p1m', name: 'Pro' })).resolves.toEqual({
      success: false,
      error: 'Internal server error',
      statusCode: 500,
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      { error: expect.any(Error) },
      'Admin update plan error',
    );

    await expect(service.deletePlan('premium-p1m')).resolves.toEqual({
      success: false,
      error: 'Internal server error',
      statusCode: 500,
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      { error: expect.any(Error) },
      'Admin delete plan error',
    );
  });

  it('preserves subscription history when an assigned plan is deleted', async () => {
    repository.deletePlan.mockRejectedValue(new BillingPlanInUseError());

    await expect(service.deletePlan('premium-p1m')).resolves.toEqual({
      success: false,
      error: 'An assigned plan cannot be deleted; deactivate it instead',
      statusCode: 409,
    });
  });

  it('delegates filtered pagination to the repository', async () => {
    repository.listSubscriptions.mockResolvedValue({
      items: [
        subscription({ id: 'sub-1', userEmail: 'alpha@example.com', payosOrderId: 'order-1' }),
      ],
      pagination: {
        currentPage: 1,
        totalPages: 2,
        totalItems: 2,
        itemsPerPage: 1,
        hasNextPage: true,
        hasPrevPage: false,
      },
    });

    const options = {
      page: 1,
      limit: 1,
      status: 'completed' as const,
      search: 'alpha',
    };
    const result = await service.listSubscriptions(options);

    expect(repository.listSubscriptions).toHaveBeenCalledWith(options);
    expect(result).toEqual({
      success: true,
      data: {
        subscriptions: [
          expect.objectContaining({
            id: 'sub-1',
            userEmail: 'alpha@example.com',
            createdAt: now.toISOString(),
          }),
        ],
        pagination: {
          currentPage: 1,
          totalPages: 2,
          totalItems: 2,
          itemsPerPage: 1,
          hasNextPage: true,
          hasPrevPage: false,
        },
      },
    });
  });

  it('omits undefined list filters and maps list failures to 500', async () => {
    repository.listSubscriptions
      .mockResolvedValueOnce({
        items: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: 20,
          hasNextPage: false,
          hasPrevPage: false,
        },
      })
      .mockRejectedValueOnce(new Error('list failed'));

    await service.listSubscriptions({ page: 1, limit: 20 });
    expect(repository.listSubscriptions).toHaveBeenCalledWith({ page: 1, limit: 20 });

    await expect(service.listSubscriptions({ page: 1, limit: 20 })).resolves.toEqual({
      success: false,
      error: 'Internal server error',
      statusCode: 500,
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      { error: expect.any(Error) },
      'Admin subscriptions list error',
    );
  });

  it('grants a user subscription using the selected plan duration', async () => {
    repository.findUserById.mockResolvedValue({
      id: '507f191e810c19729de860ea',
      email: 'user@example.com',
    });
    repository.findPlanById.mockResolvedValue(plan());
    repository.addUserSubscriptionGrant.mockResolvedValue();

    const result = await service.grantUserSubscription({
      userId: '507f191e810c19729de860ea',
      planId: 'premium-p1m',
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error);
    expect(repository.addUserSubscriptionGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        userEmail: 'user@example.com',
        planId: 'premium-p1m',
        startDate: now,
        endDate: new Date('2026-07-30T10:00:00.000Z'),
      }),
    );
    expect(result.data).toEqual({
      user: 'user@example.com',
      plan: 'Premium',
      startDate: now.toISOString(),
      endDate: '2026-07-30T10:00:00.000Z',
      isActive: true,
    });
  });

  it('reports missing user or plan during grants', async () => {
    repository.findUserById.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: '507f191e810c19729de860ea',
      email: 'user@example.com',
    });
    repository.findPlanById.mockResolvedValueOnce(plan()).mockResolvedValueOnce(null);

    await expect(
      service.grantUserSubscription({
        userId: '507f191e810c19729de860ea',
        planId: 'premium-p1m',
      }),
    ).resolves.toEqual({ success: false, error: 'User not found', statusCode: 404 });
    await expect(
      service.grantUserSubscription({
        userId: '507f191e810c19729de860ea',
        planId: 'missing',
      }),
    ).resolves.toEqual({ success: false, error: 'Plan not found', statusCode: 404 });
  });

  it('rejects inactive plans before persisting a grant', async () => {
    repository.findUserById.mockResolvedValue({
      id: '507f191e810c19729de860ea',
      email: 'user@example.com',
    });
    repository.findPlanById.mockResolvedValue(plan({ isActive: false }));

    await expect(
      service.grantUserSubscription({
        userId: '507f191e810c19729de860ea',
        planId: 'premium-p1m',
      }),
    ).resolves.toEqual({ success: false, error: 'Plan is inactive', statusCode: 409 });
    expect(repository.addUserSubscriptionGrant).not.toHaveBeenCalled();
  });

  it('maps a user-deletion race during grant persistence to 404', async () => {
    repository.findUserById.mockResolvedValue({
      id: '507f191e810c19729de860ea',
      email: 'user@example.com',
    });
    repository.findPlanById.mockResolvedValue(plan());
    repository.addUserSubscriptionGrant.mockRejectedValue(new AdminBillingUserNotFoundError());

    await expect(
      service.grantUserSubscription({
        userId: '507f191e810c19729de860ea',
        planId: 'premium-p1m',
      }),
    ).resolves.toEqual({ success: false, error: 'User not found', statusCode: 404 });
  });

  it('maps a plan-deactivation race during grant persistence to 409', async () => {
    repository.findUserById.mockResolvedValue({
      id: '507f191e810c19729de860ea',
      email: 'user@example.com',
    });
    repository.findPlanById.mockResolvedValue(plan());
    repository.addUserSubscriptionGrant.mockRejectedValue(new BillingPlanUnavailableError());

    await expect(
      service.grantUserSubscription({
        userId: '507f191e810c19729de860ea',
        planId: 'premium-p1m',
      }),
    ).resolves.toEqual({ success: false, error: 'Plan is unavailable', statusCode: 409 });
  });

  it('grants lifetime plans with the far-future end date sentinel', async () => {
    repository.findUserById.mockResolvedValue({
      id: '507f191e810c19729de860ea',
      email: 'user@example.com',
    });
    repository.findPlanById.mockResolvedValue(plan({ duration: 'PT0S' }));
    repository.addUserSubscriptionGrant.mockResolvedValue();

    const result = await service.grantUserSubscription({
      userId: '507f191e810c19729de860ea',
      planId: 'premium-p1m',
    });

    expect(result.success).toBe(true);
    expect(repository.addUserSubscriptionGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        endDate: LIFETIME_END_DATE,
      }),
    );
  });

  it('maps unexpected grant failures to 500', async () => {
    repository.findUserById.mockResolvedValue({
      id: '507f191e810c19729de860ea',
      email: 'user@example.com',
    });
    repository.findPlanById.mockResolvedValue(plan());
    repository.addUserSubscriptionGrant.mockRejectedValue(new Error('grant failed'));

    await expect(
      service.grantUserSubscription({
        userId: '507f191e810c19729de860ea',
        planId: 'premium-p1m',
      }),
    ).resolves.toEqual({
      success: false,
      error: 'Internal server error',
      statusCode: 500,
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      { error: expect.any(Error) },
      'Add subscription error',
    );
  });
});
