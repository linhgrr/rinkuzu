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
  planFindOne: vi.fn(),
  planCreate: vi.fn(),
  planFindByIdAndUpdate: vi.fn(),
  planDeleteOne: vi.fn(),
  planExists: vi.fn(),
  entitlementAccountAggregate: vi.fn(),
  entitlementGrantExists: vi.fn(),
  appendGrant: vi.fn(),
  userFindById: vi.fn(),
  userFindOne: vi.fn(),
  userExists: vi.fn(),
  userFindByIdAndUpdate: vi.fn(),
  userFindOneAndUpdate: vi.fn(),
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
    findOne: mocks.planFindOne,
    create: mocks.planCreate,
    findByIdAndUpdate: mocks.planFindByIdAndUpdate,
    deleteOne: mocks.planDeleteOne,
    exists: mocks.planExists,
  },
}));
vi.mock('@/models/Billing', () => ({
  EntitlementAccount: { aggregate: mocks.entitlementAccountAggregate },
  EntitlementGrant: { exists: mocks.entitlementGrantExists },
}));
vi.mock('@/repositories/EntitlementLedgerRepository', () => ({
  EntitlementLedgerRepository: class {
    appendGrant = mocks.appendGrant;
  },
}));
vi.mock('@/models/User', () => ({
  default: {
    findById: mocks.userFindById,
    findOne: mocks.userFindOne,
    exists: mocks.userExists,
    findByIdAndUpdate: mocks.userFindByIdAndUpdate,
    findOneAndUpdate: mocks.userFindOneAndUpdate,
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
    planId,
    planName: 'Premium',
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
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const plan = await new AdminBillingRepository().createPlan({
      id: planId,
      name: 'Premium',
      price: 99_000,
      duration: 'P1M',
      isActive: true,
    });

    expect(mocks.planCreate).toHaveBeenCalledWith({
      _id: planId,
      name: 'Premium',
      price: 99_000,
      duration: 'P1M',
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
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(BillingPlanConflictError);

    await expect(
      repository.createPlan({
        id: planId,
        name: 'Premium',
        price: 99_000,
        duration: 'P1M',
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
    mocks.entitlementGrantExists.mockReturnValueOnce({
      session: vi.fn().mockResolvedValue({ _id: 'sub' }),
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
    mocks.entitlementGrantExists.mockReturnValue({
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
    mocks.entitlementAccountAggregate.mockResolvedValue([
      { items: [subscriptionRecord()], meta: [{ totalItems: 1 }] },
    ]);

    const result = await new AdminBillingRepository().listSubscriptions({
      page: 2,
      limit: 5,
      status: 'completed',
      search: 'alpha.+@example.com',
    });

    const pipeline = mocks.entitlementAccountAggregate.mock.calls[0]?.[0];
    expect(pipeline).toEqual(
      expect.arrayContaining([
        {
          $match: {
            status: 'completed',
            $or: [
              { userEmail: /alpha\.\+@example\.com/i },
              { payosOrderId: /alpha\.\+@example\.com/i },
            ],
          },
        },
        { $sort: { updatedAt: -1 } },
      ]),
    );
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
    mocks.entitlementAccountAggregate.mockResolvedValue([{ items: [], meta: [] }]);

    await new AdminBillingRepository().listSubscriptions({
      page: 1,
      limit: 20,
      search: '   ',
    });

    const pipeline = mocks.entitlementAccountAggregate.mock.calls[0]?.[0] as Array<
      Record<string, unknown>
    >;
    expect(pipeline.some((stage) => '$match' in stage)).toBe(false);
  });

  it('finds billing user identity by id with exact-active filter', async () => {
    mocks.userFindOne
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
    expect(mocks.userFindOne).toHaveBeenCalledWith({ _id: userId, disable: 0 });
  });

  it('grants a subscription only for an active plan and existing active user', async () => {
    mocks.planFindOne.mockReturnValue({
      select: () => ({
        session: () => leanChain({ duration: 'P1M' }),
      }),
    });
    mocks.userFindOne.mockReturnValue({
      select: () => ({
        session: () => leanChain({ _id: new Types.ObjectId(userId) }),
      }),
    });
    mocks.appendGrant.mockResolvedValue(undefined);

    const startDate = new Date('2026-07-01T00:00:00.000Z');
    const endDate = new Date('2026-08-01T00:00:00.000Z');

    await new AdminBillingRepository().addUserSubscriptionGrant({
      userId,
      userEmail: 'user@example.com',
      planId,
      planName: 'Premium',
      amount: 99_000,
      startDate,
      endDate,
    });

    expect(mocks.planFindOne).toHaveBeenCalledWith({ _id: planId, isActive: true });
    expect(mocks.userFindOne).toHaveBeenCalledWith({ _id: userId, disable: 0 });
    expect(mocks.appendGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.any(Types.ObjectId),
        sourceType: 'manual',
        sourceId: 'admin_11111111-2222-3333-4444-555555555555',
        planId,
        planName: 'Premium',
        durationUnit: 'month',
        durationValue: 1,
        committedAt: startDate,
      }),
      expect.any(Object),
    );
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it('maps grant races for unavailable plan and missing/disabled user', async () => {
    mocks.planFindOne.mockReturnValueOnce({
      select: () => ({ session: () => leanChain(null) }),
    });

    await expect(
      new AdminBillingRepository().addUserSubscriptionGrant({
        userId,
        userEmail: 'user@example.com',
        planId,
        planName: 'Premium',
        amount: 99_000,
        startDate: now,
      }),
    ).rejects.toBeInstanceOf(BillingPlanUnavailableError);

    mocks.planFindOne.mockReturnValueOnce({
      select: () => ({ session: () => leanChain({ duration: 'P1M' }) }),
    });
    mocks.userFindOne.mockReturnValueOnce({
      select: () => ({ session: () => leanChain(null) }),
    });

    await expect(
      new AdminBillingRepository().addUserSubscriptionGrant({
        userId,
        userEmail: 'user@example.com',
        planId,
        planName: 'Premium',
        amount: 99_000,
        startDate: now,
      }),
    ).rejects.toBeInstanceOf(AdminBillingUserNotFoundError);
  });
});
