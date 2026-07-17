import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import {
  AdminBillingUserNotFoundError,
  BillingPlanConflictError,
  BillingPlanInUseError,
  BillingPlanUnavailableError,
} from '@/entities/AdminBilling';

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  planFind: vi.fn(),
  planFindById: vi.fn(),
  planCreate: vi.fn(),
  planFindByIdAndUpdate: vi.fn(),
  planDeleteOne: vi.fn(),
  planExists: vi.fn(),
  subscriptionFind: vi.fn(),
  subscriptionCountDocuments: vi.fn(),
  subscriptionExists: vi.fn(),
  subscriptionCreate: vi.fn(),
  userFindById: vi.fn(),
  userExists: vi.fn(),
  userFindByIdAndUpdate: vi.fn(),
  withTransaction: vi.fn(),
  endSession: vi.fn(),
  startSession: vi.fn(),
  randomUUID: vi.fn(() => '11111111-2222-3333-4444-555555555555'),
}));

vi.mock('node:crypto', () => ({
  randomUUID: mocks.randomUUID,
}));
vi.mock('@/lib/mongoose', () => ({ default: mocks.connectDB }));
vi.mock('@/models/Plan', () => ({
  default: {
    find: mocks.planFind,
    findById: mocks.planFindById,
    create: mocks.planCreate,
    findByIdAndUpdate: mocks.planFindByIdAndUpdate,
    deleteOne: mocks.planDeleteOne,
    exists: mocks.planExists,
  },
}));
vi.mock('@/models/Subscription', () => ({
  default: {
    find: mocks.subscriptionFind,
    countDocuments: mocks.subscriptionCountDocuments,
    exists: mocks.subscriptionExists,
    create: mocks.subscriptionCreate,
  },
}));
vi.mock('@/models/User', () => ({
  default: {
    findById: mocks.userFindById,
    exists: mocks.userExists,
    findByIdAndUpdate: mocks.userFindByIdAndUpdate,
  },
}));
vi.mock('mongoose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('mongoose')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      startSession: mocks.startSession,
    },
  };
});

import { AdminBillingRepository } from '@/repositories/AdminBillingRepository';

const now = new Date('2026-07-01T00:00:00.000Z');
const planId = 'premium-p1m';
const userId = '507f191e810c19729de860ea';
const subscriptionId = '507f191e810c19729de860eb';

function planRecord(overrides: Record<string, unknown> = {}) {
  return {
    _id: planId,
    name: 'Premium',
    price: 99_000,
    duration: 'P1M',
    features: ['AI'],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function subscriptionRecord(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(subscriptionId),
    user: new Types.ObjectId(userId),
    userEmail: 'user@example.com',
    type: planId,
    amount: 99_000,
    currency: 'VND',
    status: 'completed' as const,
    payosOrderId: 'order-1',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function leanChain(result: unknown) {
  return { lean: vi.fn().mockResolvedValue(result) };
}

describe('AdminBillingRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectDB.mockResolvedValue(undefined);
    mocks.withTransaction.mockImplementation(async (callback: () => Promise<void>) => callback());
    mocks.startSession.mockResolvedValue({
      withTransaction: mocks.withTransaction,
      endSession: mocks.endSession,
    });
    mocks.randomUUID.mockReturnValue('11111111-2222-3333-4444-555555555555');
  });

  it('lists plans and maps persistence records', async () => {
    mocks.planFind.mockReturnValue(leanChain([planRecord()]));

    const plans = await new AdminBillingRepository().listPlans();

    expect(mocks.connectDB).toHaveBeenCalledOnce();
    expect(plans).toEqual([
      expect.objectContaining({
        id: planId,
        name: 'Premium',
        price: 99_000,
        duration: 'P1M',
        features: ['AI'],
        isActive: true,
      }),
    ]);
  });

  it('finds a plan by id and returns null when missing', async () => {
    mocks.planFindById
      .mockReturnValueOnce(leanChain(planRecord()))
      .mockReturnValueOnce(leanChain(null));

    const repository = new AdminBillingRepository();
    await expect(repository.findPlanById(planId)).resolves.toMatchObject({ id: planId });
    await expect(repository.findPlanById('missing')).resolves.toBeNull();
  });

  it('creates a plan and maps the saved document', async () => {
    mocks.planCreate.mockResolvedValue({
      _id: planId,
      name: 'Premium',
      price: 99_000,
      duration: 'P1M',
      features: ['AI'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const plan = await new AdminBillingRepository().createPlan({
      id: planId,
      name: 'Premium',
      price: 99_000,
      duration: 'P1M',
      features: ['AI'],
      isActive: true,
    });

    expect(mocks.planCreate).toHaveBeenCalledWith({
      _id: planId,
      name: 'Premium',
      price: 99_000,
      duration: 'P1M',
      features: ['AI'],
      isActive: true,
    });
    expect(plan).toMatchObject({ id: planId, name: 'Premium' });
  });

  it('maps duplicate-key create failures to BillingPlanConflictError and rethrows others', async () => {
    mocks.planCreate
      .mockRejectedValueOnce({ code: 11000 })
      .mockRejectedValueOnce(new Error('write concern'));

    const repository = new AdminBillingRepository();
    await expect(
      repository.createPlan({
        id: planId,
        name: 'Premium',
        price: 99_000,
        duration: 'P1M',
        features: [],
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(BillingPlanConflictError);

    await expect(
      repository.createPlan({
        id: planId,
        name: 'Premium',
        price: 99_000,
        duration: 'P1M',
        features: [],
        isActive: true,
      }),
    ).rejects.toThrow('write concern');
  });

  it('updates a plan with validators and maps null when missing', async () => {
    mocks.planFindByIdAndUpdate
      .mockReturnValueOnce(leanChain(planRecord({ name: 'Pro' })))
      .mockReturnValueOnce(leanChain(null));

    const repository = new AdminBillingRepository();
    await expect(repository.updatePlan(planId, { name: 'Pro' })).resolves.toMatchObject({
      name: 'Pro',
    });
    expect(mocks.planFindByIdAndUpdate).toHaveBeenCalledWith(
      planId,
      { name: 'Pro' },
      { new: true, upsert: false, runValidators: true },
    );
    await expect(repository.updatePlan('missing', { name: 'Pro' })).resolves.toBeNull();
  });

  it('deletes a plan only when unused, and reports missing plans as not deleted', async () => {
    const session = { withTransaction: mocks.withTransaction, endSession: mocks.endSession };
    mocks.startSession.mockResolvedValue(session);

    const sessionChain = {
      select: vi.fn().mockReturnValue({
        session: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(null),
        }),
      }),
    };
    mocks.planFindById.mockReturnValueOnce(sessionChain);

    const repository = new AdminBillingRepository();
    await expect(repository.deletePlan(planId)).resolves.toBe(false);
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it('rejects delete when the plan is assigned to a subscription or user', async () => {
    const repository = new AdminBillingRepository();

    mocks.planFindById.mockReturnValueOnce({
      select: () => ({
        session: () => ({
          lean: vi.fn().mockResolvedValue({ _id: planId }),
        }),
      }),
    });
    mocks.subscriptionExists.mockReturnValueOnce({
      session: vi.fn().mockResolvedValue({ _id: 'sub' }),
    });
    mocks.userExists.mockReturnValueOnce({
      session: vi.fn().mockResolvedValue(null),
    });

    await expect(repository.deletePlan(planId)).rejects.toBeInstanceOf(BillingPlanInUseError);

    mocks.planFindById.mockReturnValueOnce({
      select: () => ({
        session: () => ({
          lean: vi.fn().mockResolvedValue({ _id: planId }),
        }),
      }),
    });
    mocks.subscriptionExists.mockReturnValueOnce({
      session: vi.fn().mockResolvedValue(null),
    });
    mocks.userExists.mockReturnValueOnce({
      session: vi.fn().mockResolvedValue({ _id: userId }),
    });

    await expect(repository.deletePlan(planId)).rejects.toBeInstanceOf(BillingPlanInUseError);
  });

  it('deletes an unused plan and returns true only when deletedCount is 1', async () => {
    mocks.planFindById.mockReturnValue({
      select: () => ({
        session: () => ({
          lean: vi.fn().mockResolvedValue({ _id: planId }),
        }),
      }),
    });
    mocks.subscriptionExists.mockReturnValue({
      session: vi.fn().mockResolvedValue(null),
    });
    mocks.userExists.mockReturnValue({
      session: vi.fn().mockResolvedValue(null),
    });
    mocks.planDeleteOne
      .mockReturnValueOnce({ session: vi.fn().mockResolvedValue({ deletedCount: 1 }) })
      .mockReturnValueOnce({ session: vi.fn().mockResolvedValue({ deletedCount: 0 }) });

    const repository = new AdminBillingRepository();
    await expect(repository.deletePlan(planId)).resolves.toBe(true);
    expect(mocks.planDeleteOne).toHaveBeenCalledWith({ _id: planId });
    await expect(repository.deletePlan(planId)).resolves.toBe(false);
  });

  it('lists subscriptions with status/search filters, escaped regex, and pagination', async () => {
    const sort = vi.fn().mockReturnValue({
      skip: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([subscriptionRecord()]),
        }),
      }),
    });
    mocks.subscriptionFind.mockReturnValue({ sort });
    mocks.subscriptionCountDocuments.mockResolvedValue(1);

    const result = await new AdminBillingRepository().listSubscriptions({
      page: 2,
      limit: 5,
      status: 'completed',
      search: 'alpha.+@example.com',
    });

    expect(mocks.subscriptionFind).toHaveBeenCalledWith({
      status: 'completed',
      $or: [{ userEmail: /alpha\.\+@example\.com/i }, { payosOrderId: /alpha\.\+@example\.com/i }],
    });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: subscriptionId,
      userEmail: 'user@example.com',
      status: 'completed',
    });
    expect(result.pagination).toEqual({
      currentPage: 2,
      totalPages: 1,
      totalItems: 1,
      itemsPerPage: 5,
      hasNextPage: false,
      hasPrevPage: true,
    });
  });

  it('lists subscriptions without optional filters when omitted or blank', async () => {
    const sort = vi.fn().mockReturnValue({
      skip: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mocks.subscriptionFind.mockReturnValue({ sort });
    mocks.subscriptionCountDocuments.mockResolvedValue(0);

    await new AdminBillingRepository().listSubscriptions({
      page: 1,
      limit: 20,
      search: '   ',
    });

    expect(mocks.subscriptionFind).toHaveBeenCalledWith({});
  });

  it('finds billing user identity by id and returns null when missing', async () => {
    mocks.userFindById
      .mockReturnValueOnce({
        select: () =>
          leanChain({
            _id: new Types.ObjectId(userId),
            email: 'user@example.com',
          }),
      })
      .mockReturnValueOnce({
        select: () => leanChain(null),
      });

    const repository = new AdminBillingRepository();
    await expect(repository.findUserById(userId)).resolves.toEqual({
      id: userId,
      email: 'user@example.com',
    });
    await expect(repository.findUserById(userId)).resolves.toBeNull();
  });

  it('grants a subscription only for an active plan and existing user', async () => {
    mocks.planExists.mockReturnValue({
      session: vi.fn().mockResolvedValue({ _id: planId }),
    });
    mocks.userFindByIdAndUpdate.mockReturnValue({
      select: () => ({
        lean: vi.fn().mockResolvedValue({ _id: new Types.ObjectId(userId) }),
      }),
    });
    mocks.subscriptionCreate.mockResolvedValue([]);

    const startDate = new Date('2026-07-01T00:00:00.000Z');
    const endDate = new Date('2026-08-01T00:00:00.000Z');

    await new AdminBillingRepository().addUserSubscriptionGrant({
      userId,
      userEmail: 'user@example.com',
      planId,
      amount: 99_000,
      startDate,
      endDate,
    });

    expect(mocks.planExists).toHaveBeenCalledWith({ _id: planId, isActive: true });
    expect(mocks.userFindByIdAndUpdate).toHaveBeenCalledWith(
      userId,
      {
        subscription: {
          type: planId,
          startDate,
          endDate,
          isActive: true,
          payosOrderId: 'admin_11111111-2222-3333-4444-555555555555',
          payosTransactionId: 'admin_11111111-2222-3333-4444-555555555555',
        },
      },
      expect.objectContaining({ session: expect.any(Object) }),
    );
    expect(mocks.subscriptionCreate).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          user: expect.any(Types.ObjectId),
          userEmail: 'user@example.com',
          type: planId,
          amount: 99_000,
          currency: 'VND',
          status: 'completed',
          payosOrderId: 'admin_11111111-2222-3333-4444-555555555555',
          payosTransactionId: 'admin_11111111-2222-3333-4444-555555555555',
          startDate,
          endDate,
          isActive: true,
        }),
      ],
      expect.objectContaining({ session: expect.any(Object) }),
    );
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it('maps grant races for unavailable plan and missing user', async () => {
    mocks.planExists.mockReturnValueOnce({
      session: vi.fn().mockResolvedValue(null),
    });

    await expect(
      new AdminBillingRepository().addUserSubscriptionGrant({
        userId,
        userEmail: 'user@example.com',
        planId,
        amount: 99_000,
        startDate: now,
      }),
    ).rejects.toBeInstanceOf(BillingPlanUnavailableError);

    mocks.planExists.mockReturnValueOnce({
      session: vi.fn().mockResolvedValue({ _id: planId }),
    });
    mocks.userFindByIdAndUpdate.mockReturnValueOnce({
      select: () => ({
        lean: vi.fn().mockResolvedValue(null),
      }),
    });

    await expect(
      new AdminBillingRepository().addUserSubscriptionGrant({
        userId,
        userEmail: 'user@example.com',
        planId,
        amount: 99_000,
        startDate: now,
      }),
    ).rejects.toBeInstanceOf(AdminBillingUserNotFoundError);
  });
});
