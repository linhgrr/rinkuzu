import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { SubscriptionActivationConflictError } from '@/entities/Subscription';

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  subscriptionCreate: vi.fn(),
  subscriptionFindById: vi.fn(),
  subscriptionFindOne: vi.fn(),
  subscriptionFind: vi.fn(),
  subscriptionUpdateMany: vi.fn(),
  subscriptionUpdateOne: vi.fn(),
  subscriptionFindByIdAndUpdate: vi.fn(),
  subscriptionFindOneAndUpdate: vi.fn(),
  subscriptionLean: vi.fn(),
  subscriptionSelect: vi.fn(),
  subscriptionSession: vi.fn(),
  subscriptionSave: vi.fn(),
  userFind: vi.fn(),
  userFindById: vi.fn(),
  userUpdateOne: vi.fn(),
  userUpdateMany: vi.fn(),
  userLean: vi.fn(),
  userSelect: vi.fn(),
  userSession: vi.fn(),
  withTransaction: vi.fn(),
  endSession: vi.fn(),
  startSession: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({ default: mocks.connectDB }));
vi.mock('@/models/Subscription', () => ({
  default: {
    create: mocks.subscriptionCreate,
    findById: mocks.subscriptionFindById,
    findOne: mocks.subscriptionFindOne,
    find: mocks.subscriptionFind,
    updateMany: mocks.subscriptionUpdateMany,
    updateOne: mocks.subscriptionUpdateOne,
    findByIdAndUpdate: mocks.subscriptionFindByIdAndUpdate,
    findOneAndUpdate: mocks.subscriptionFindOneAndUpdate,
  },
}));
vi.mock('@/models/User', () => ({
  default: {
    find: mocks.userFind,
    findById: mocks.userFindById,
    updateOne: mocks.userUpdateOne,
    updateMany: mocks.userUpdateMany,
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

import { SubscriptionRepository } from '@/repositories/SubscriptionRepository';

const userId = '507f191e810c19729de860ea';
const subscriptionId = '507f191e810c19729de860eb';
const orderId = 'order-123';

function pendingRecord(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(subscriptionId),
    user: new Types.ObjectId(userId),
    userEmail: 'user@example.com',
    type: 'premium',
    amount: 99_000,
    currency: 'VND',
    status: 'pending' as const,
    payosOrderId: orderId,
    isActive: false,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    ...overrides,
  };
}

function completedRecord(overrides: Record<string, unknown> = {}) {
  return pendingRecord({
    status: 'completed',
    isActive: true,
    startDate: new Date('2026-07-01T00:00:00.000Z'),
    endDate: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  });
}

function leanChain(result: unknown) {
  return { lean: vi.fn().mockResolvedValue(result) };
}

describe('SubscriptionRepository.findByTransactionReference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.subscriptionLean.mockResolvedValue(null);
    mocks.subscriptionFindOne.mockReturnValue({ lean: mocks.subscriptionLean });
  });

  it('matches transaction references through the partial-index type contract', async () => {
    await new SubscriptionRepository().findByTransactionReference('transaction-reference');

    expect(mocks.subscriptionFindOne).toHaveBeenCalledWith({
      payosTransactionId: { $eq: 'transaction-reference', $type: 'string' },
    });
  });
});

describe('SubscriptionRepository lookups and simple writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates and maps a pending subscription record', async () => {
    mocks.subscriptionCreate.mockResolvedValue({
      toObject: () => pendingRecord(),
    });

    const created = await new SubscriptionRepository().create({
      userId,
      userEmail: 'user@example.com',
      type: 'premium',
      amount: 99_000,
      currency: 'VND',
      status: 'pending',
      payosOrderId: orderId,
    });

    expect(mocks.subscriptionCreate).toHaveBeenCalledWith({
      user: userId,
      userEmail: 'user@example.com',
      type: 'premium',
      amount: 99_000,
      currency: 'VND',
      status: 'pending',
      payosOrderId: orderId,
    });
    expect(created).toMatchObject({
      id: subscriptionId,
      userId,
      status: 'pending',
      payosOrderId: orderId,
    });
  });

  it('maps findById / findByOrderId hits and misses', async () => {
    mocks.subscriptionFindById
      .mockReturnValueOnce(leanChain(completedRecord()))
      .mockReturnValueOnce(leanChain(null));
    mocks.subscriptionFindOne
      .mockReturnValueOnce(leanChain(completedRecord()))
      .mockReturnValueOnce(leanChain(null));

    const repository = new SubscriptionRepository();
    await expect(repository.findById(subscriptionId)).resolves.toMatchObject({
      status: 'completed',
      id: subscriptionId,
    });
    await expect(repository.findById(subscriptionId)).resolves.toBeNull();
    await expect(repository.findByOrderId(orderId)).resolves.toMatchObject({
      payosOrderId: orderId,
    });
    await expect(repository.findByOrderId(orderId)).resolves.toBeNull();
  });

  it('updates by id and order id, mapping null when missing', async () => {
    mocks.subscriptionFindByIdAndUpdate
      .mockReturnValueOnce(leanChain(completedRecord({ amount: 120_000 })))
      .mockReturnValueOnce(leanChain(null));
    mocks.subscriptionFindOneAndUpdate
      .mockReturnValueOnce(leanChain(completedRecord({ amount: 80_000 })))
      .mockReturnValueOnce(leanChain(null));

    const repository = new SubscriptionRepository();
    await expect(
      repository.updateById(subscriptionId, { status: 'completed' }),
    ).resolves.toMatchObject({ amount: 120_000 });
    expect(mocks.subscriptionFindByIdAndUpdate).toHaveBeenCalledWith(
      subscriptionId,
      { status: 'completed' },
      { new: true },
    );
    await expect(repository.updateById(subscriptionId, { status: 'pending' })).resolves.toBeNull();
    await expect(
      repository.updateByOrderId(orderId, { status: 'completed' }),
    ).resolves.toMatchObject({ amount: 80_000 });
    expect(mocks.subscriptionFindOneAndUpdate).toHaveBeenCalledWith(
      { payosOrderId: orderId },
      { status: 'completed' },
      { new: true },
    );
    await expect(repository.updateByOrderId(orderId, { status: 'pending' })).resolves.toBeNull();
  });
});

describe('SubscriptionRepository.activateSubscription', () => {
  const activation = {
    orderId,
    userId,
    type: 'premium',
    startDate: new Date('2026-07-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withTransaction.mockImplementation(async (callback: () => Promise<void>) => callback());
    mocks.startSession.mockResolvedValue({
      withTransaction: mocks.withTransaction,
      endSession: mocks.endSession,
    });
    mocks.subscriptionUpdateOne.mockResolvedValue({ matchedCount: 1 });
    mocks.userUpdateOne.mockResolvedValue({ matchedCount: 1 });
  });

  it('requires the pending order and owner, and omits absent optional fields', async () => {
    await new SubscriptionRepository().activateSubscription(activation);

    expect(mocks.subscriptionUpdateOne).toHaveBeenCalledWith(
      {
        payosOrderId: activation.orderId,
        user: activation.userId,
        status: 'pending',
      },
      {
        $set: {
          status: 'completed',
          startDate: activation.startDate,
          isActive: true,
        },
      },
      expect.objectContaining({ session: expect.any(Object) }),
    );
    expect(mocks.userUpdateOne).toHaveBeenCalledWith(
      { _id: activation.userId, disable: 0 },
      {
        $set: {
          subscription: {
            type: activation.type,
            startDate: activation.startDate,
            isActive: true,
            payosOrderId: activation.orderId,
          },
        },
      },
      expect.objectContaining({ session: expect.any(Object) }),
    );
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it('includes transaction reference and end date when provided', async () => {
    const endDate = new Date('2026-08-01T00:00:00.000Z');
    await new SubscriptionRepository().activateSubscription({
      ...activation,
      transactionReference: 'txn-ref',
      endDate,
    });

    expect(mocks.subscriptionUpdateOne).toHaveBeenCalledWith(
      expect.any(Object),
      {
        $set: {
          status: 'completed',
          payosTransactionId: 'txn-ref',
          startDate: activation.startDate,
          endDate,
          isActive: true,
        },
      },
      expect.any(Object),
    );
    expect(mocks.userUpdateOne).toHaveBeenCalledWith(
      { _id: activation.userId, disable: 0 },
      {
        $set: {
          subscription: {
            type: activation.type,
            startDate: activation.startDate,
            endDate,
            isActive: true,
            payosOrderId: activation.orderId,
            payosTransactionId: 'txn-ref',
          },
        },
      },
      expect.any(Object),
    );
  });

  it('fails closed before updating the user when the pending order did not match', async () => {
    mocks.subscriptionUpdateOne.mockResolvedValue({ matchedCount: 0 });

    await expect(new SubscriptionRepository().activateSubscription(activation)).rejects.toThrow(
      SubscriptionActivationConflictError,
    );
    expect(mocks.userUpdateOne).not.toHaveBeenCalled();
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it('fails closed and lets the transaction roll back when the user did not match', async () => {
    mocks.userUpdateOne.mockResolvedValue({ matchedCount: 0 });

    await expect(new SubscriptionRepository().activateSubscription(activation)).rejects.toThrow(
      'Subscription user changed before activation',
    );
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });
});

describe('SubscriptionRepository transactional lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withTransaction.mockImplementation(async (callback: () => Promise<void>) => callback());
    mocks.startSession.mockResolvedValue({
      withTransaction: mocks.withTransaction,
      endSession: mocks.endSession,
    });
  });

  it('expires due subscriptions and active user snapshots', async () => {
    const now = new Date('2026-07-15T00:00:00.000Z');
    const subId = new Types.ObjectId();
    const userObjectId = new Types.ObjectId(userId);
    const userWithoutOrder = new Types.ObjectId();
    mocks.subscriptionSession.mockReturnValue({
      lean: vi.fn().mockResolvedValue([{ _id: subId, user: userObjectId, payosOrderId: orderId }]),
    });
    mocks.subscriptionSelect.mockReturnValue({ session: mocks.subscriptionSession });
    mocks.subscriptionFind.mockReturnValue({ select: mocks.subscriptionSelect });
    mocks.userSession.mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        {
          _id: userObjectId,
          subscription: {
            isActive: true,
            endDate: now,
            payosOrderId: orderId,
          },
        },
        {
          _id: userWithoutOrder,
          subscription: {
            isActive: true,
            endDate: now,
          },
        },
      ]),
    });
    mocks.userSelect.mockReturnValue({ session: mocks.userSession });
    mocks.userFind.mockReturnValue({ select: mocks.userSelect });
    mocks.subscriptionUpdateMany.mockReturnValue({
      session: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    });
    mocks.userUpdateMany.mockReturnValue({
      session: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    });

    const expired = await new SubscriptionRepository().expireDue(now);

    expect(expired).toEqual({
      count: 2,
      userIds: expect.arrayContaining([userId, String(userWithoutOrder)]),
    });
    expect(expired.userIds).toHaveLength(2);
    expect(mocks.subscriptionFind).toHaveBeenCalledWith({
      isActive: true,
      endDate: { $exists: true, $lte: now },
      status: 'completed',
    });
    expect(mocks.subscriptionSelect).toHaveBeenCalledWith('_id user payosOrderId');
    expect(mocks.userFind).toHaveBeenCalledWith({
      'subscription.isActive': true,
      'subscription.endDate': { $exists: true, $lte: now },
    });
    expect(mocks.userSelect).toHaveBeenCalledWith('_id subscription');
    // Update is constrained to projected candidate ids (no open date re-match).
    expect(mocks.subscriptionUpdateMany).toHaveBeenCalledWith(
      {
        $or: [{ _id: { $in: [subId] } }, { payosOrderId: { $in: [orderId] } }],
        status: 'completed',
        isActive: true,
      },
      { $set: { status: 'expired', isActive: false } },
    );
    expect(mocks.userUpdateMany).toHaveBeenCalledWith(
      {
        _id: { $in: [userObjectId, userWithoutOrder] },
        'subscription.isActive': true,
      },
      { $set: { 'subscription.isActive': false } },
    );
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it('returns zero metadata and skips updates when no expiry candidates exist', async () => {
    const now = new Date('2026-07-15T00:00:00.000Z');
    mocks.subscriptionSession.mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    });
    mocks.subscriptionSelect.mockReturnValue({ session: mocks.subscriptionSession });
    mocks.subscriptionFind.mockReturnValue({ select: mocks.subscriptionSelect });
    mocks.userSession.mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    });
    mocks.userSelect.mockReturnValue({ session: mocks.userSession });
    mocks.userFind.mockReturnValue({ select: mocks.userSelect });

    await expect(new SubscriptionRepository().expireDue(now)).resolves.toEqual({
      count: 0,
      userIds: [],
    });
    expect(mocks.subscriptionUpdateMany).not.toHaveBeenCalled();
    expect(mocks.userUpdateMany).not.toHaveBeenCalled();
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it('updates admin status when transitions are allowed and rejects invalid ones', async () => {
    const cancelledRecord = completedRecord({ status: 'cancelled', isActive: false });
    const mutableDoc = {
      ...completedRecord(),
      status: 'completed' as 'completed' | 'cancelled',
      endDate: new Date('2026-08-01T00:00:00.000Z'),
      payosOrderId: orderId,
      user: new Types.ObjectId(userId),
      save: mocks.subscriptionSave,
      toObject: () => cancelledRecord,
    };
    const lifetimeDoc = {
      ...completedRecord(),
      status: 'completed' as const,
      endDate: undefined,
      save: mocks.subscriptionSave,
      toObject: () => completedRecord(),
    };
    const alreadyCancelledDoc = {
      ...completedRecord(),
      status: 'cancelled' as const,
      endDate: new Date('2026-08-01T00:00:00.000Z'),
      save: mocks.subscriptionSave,
      toObject: () => completedRecord({ status: 'cancelled' }),
    };
    mocks.subscriptionSave.mockImplementation(async function save(this: typeof mutableDoc) {
      this.status = 'cancelled';
      this.isActive = false;
      return this;
    });
    mocks.subscriptionFindById
      .mockReturnValueOnce({ session: vi.fn().mockResolvedValue(null) })
      .mockReturnValueOnce({ session: vi.fn().mockResolvedValue(lifetimeDoc) })
      .mockReturnValueOnce({ session: vi.fn().mockResolvedValue(alreadyCancelledDoc) })
      .mockReturnValueOnce({ session: vi.fn().mockResolvedValue(mutableDoc) });
    mocks.userUpdateOne.mockResolvedValue({ matchedCount: 1 });

    const repository = new SubscriptionRepository();
    await expect(repository.updateAdminStatusById(subscriptionId, 'cancelled')).resolves.toEqual({
      outcome: 'not_found',
    });
    await expect(repository.updateAdminStatusById(subscriptionId, 'expired')).resolves.toEqual({
      outcome: 'invalid_transition',
      currentStatus: 'completed',
    });
    await expect(repository.updateAdminStatusById(subscriptionId, 'cancelled')).resolves.toEqual({
      outcome: 'invalid_transition',
      currentStatus: 'cancelled',
    });
    await expect(
      repository.updateAdminStatusById(subscriptionId, 'cancelled'),
    ).resolves.toMatchObject({
      outcome: 'updated',
      subscription: expect.objectContaining({ status: 'cancelled' }),
    });
    expect(mutableDoc.isActive).toBe(false);
    expect(mocks.userUpdateOne).toHaveBeenCalledWith(
      {
        _id: mutableDoc.user,
        'subscription.payosOrderId': orderId,
      },
      { $set: { 'subscription.isActive': false } },
      expect.objectContaining({ session: expect.any(Object) }),
    );
  });

  it('expires the current user subscription only when both records match', async () => {
    mocks.subscriptionUpdateOne
      .mockResolvedValueOnce({ matchedCount: 0 })
      .mockResolvedValueOnce({ matchedCount: 1 })
      .mockResolvedValueOnce({ matchedCount: 1 });
    mocks.userUpdateOne
      .mockResolvedValueOnce({ matchedCount: 1 })
      .mockResolvedValueOnce({ matchedCount: 0 });

    const repository = new SubscriptionRepository();
    await expect(repository.expireCurrentForUser(userId, orderId)).resolves.toBe(false);
    await expect(repository.expireCurrentForUser(userId, orderId)).resolves.toBe(true);
    expect(mocks.subscriptionUpdateOne).toHaveBeenCalledWith(
      {
        user: userId,
        payosOrderId: orderId,
        status: 'completed',
        isActive: true,
      },
      { $set: { status: 'expired', isActive: false } },
      expect.objectContaining({ session: expect.any(Object) }),
    );
    expect(mocks.userUpdateOne).toHaveBeenCalledWith(
      {
        _id: userId,
        'subscription.payosOrderId': orderId,
        'subscription.isActive': true,
      },
      { $set: { 'subscription.isActive': false } },
      expect.objectContaining({ session: expect.any(Object) }),
    );

    await expect(repository.expireCurrentForUser(userId, orderId)).rejects.toThrow(
      'Current user subscription changed during expiry',
    );
  });

  it('cancels the current time-limited subscription and maps guard outcomes', async () => {
    const repository = new SubscriptionRepository();
    mocks.userFindById
      .mockReturnValueOnce({
        select: () => ({
          session: () => ({
            lean: vi.fn().mockResolvedValue(null),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: () => ({
          session: () => ({
            lean: vi.fn().mockResolvedValue({
              _id: new Types.ObjectId(userId),
              subscription: { isActive: true, payosOrderId: orderId },
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: () => ({
          session: () => ({
            lean: vi.fn().mockResolvedValue({
              _id: new Types.ObjectId(userId),
              subscription: {
                isActive: false,
                endDate: new Date('2026-08-01T00:00:00.000Z'),
                payosOrderId: orderId,
              },
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: () => ({
          session: () => ({
            lean: vi.fn().mockResolvedValue({
              _id: new Types.ObjectId(userId),
              subscription: {
                isActive: true,
                endDate: new Date('2026-08-01T00:00:00.000Z'),
              },
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: () => ({
          session: () => ({
            lean: vi.fn().mockResolvedValue({
              _id: new Types.ObjectId(userId),
              subscription: {
                isActive: true,
                endDate: new Date('2026-08-01T00:00:00.000Z'),
                payosOrderId: orderId,
              },
            }),
          }),
        }),
      });
    mocks.subscriptionUpdateOne.mockResolvedValue({ matchedCount: 1 });
    mocks.userUpdateOne.mockResolvedValue({ matchedCount: 1 });

    await expect(repository.cancelCurrentForUser(userId)).resolves.toEqual({
      outcome: 'user_not_found',
    });
    await expect(repository.cancelCurrentForUser(userId)).resolves.toEqual({
      outcome: 'not_time_limited',
    });
    await expect(repository.cancelCurrentForUser(userId)).resolves.toEqual({
      outcome: 'already_inactive',
    });
    await expect(repository.cancelCurrentForUser(userId)).resolves.toEqual({
      outcome: 'inconsistent_record',
    });
    await expect(repository.cancelCurrentForUser(userId)).resolves.toEqual({
      outcome: 'cancelled',
    });
    expect(mocks.subscriptionUpdateOne).toHaveBeenCalledWith(
      {
        user: expect.any(Types.ObjectId),
        payosOrderId: orderId,
        status: 'completed',
        isActive: true,
      },
      {
        $set: {
          status: 'cancelled',
          isActive: false,
        },
      },
      expect.objectContaining({ session: expect.any(Object) }),
    );
    expect(mocks.userUpdateOne).toHaveBeenCalledWith(
      {
        _id: expect.any(Types.ObjectId),
        'subscription.payosOrderId': orderId,
        'subscription.isActive': true,
      },
      { $set: { 'subscription.isActive': false } },
      expect.objectContaining({ session: expect.any(Object) }),
    );
  });

  it('maps cancel inconsistency when the active subscription row no longer matches', async () => {
    mocks.userFindById.mockReturnValueOnce({
      select: () => ({
        session: () => ({
          lean: vi.fn().mockResolvedValue({
            _id: new Types.ObjectId(userId),
            subscription: {
              isActive: true,
              endDate: new Date('2026-08-01T00:00:00.000Z'),
              payosOrderId: orderId,
            },
          }),
        }),
      }),
    });
    mocks.subscriptionUpdateOne.mockResolvedValueOnce({ matchedCount: 0 });

    await expect(new SubscriptionRepository().cancelCurrentForUser(userId)).resolves.toEqual({
      outcome: 'inconsistent_record',
    });
    expect(mocks.userUpdateOne).not.toHaveBeenCalled();
  });

  it('fails closed when the user snapshot changes mid-cancellation', async () => {
    mocks.userFindById.mockReturnValueOnce({
      select: () => ({
        session: () => ({
          lean: vi.fn().mockResolvedValue({
            _id: new Types.ObjectId(userId),
            subscription: {
              isActive: true,
              endDate: new Date('2026-08-01T00:00:00.000Z'),
              payosOrderId: orderId,
            },
          }),
        }),
      }),
    });
    mocks.subscriptionUpdateOne.mockResolvedValueOnce({ matchedCount: 1 });
    mocks.userUpdateOne.mockResolvedValueOnce({ matchedCount: 0 });

    await expect(new SubscriptionRepository().cancelCurrentForUser(userId)).rejects.toThrow(
      'Current user subscription changed during cancellation',
    );
  });
});
