import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionActivationConflictError } from '@/entities/Subscription';

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  subscriptionUpdateOne: vi.fn(),
  subscriptionFindOne: vi.fn(),
  subscriptionLean: vi.fn(),
  userUpdateOne: vi.fn(),
  withTransaction: vi.fn(),
  endSession: vi.fn(),
  startSession: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({ default: mocks.connectDB }));
vi.mock('@/models/Subscription', () => ({
  default: {
    updateOne: mocks.subscriptionUpdateOne,
    findOne: mocks.subscriptionFindOne,
  },
}));
vi.mock('@/models/User', () => ({ default: { updateOne: mocks.userUpdateOne } }));
vi.mock('mongoose', () => ({
  default: {
    startSession: mocks.startSession,
    Types: { ObjectId: { isValid: vi.fn() } },
  },
}));

import { SubscriptionRepository } from '@/repositories/SubscriptionRepository';

const activation = {
  orderId: '123',
  userId: '507f191e810c19729de860ea',
  type: 'premium',
  startDate: new Date('2026-07-01T00:00:00.000Z'),
};

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

describe('SubscriptionRepository.activateSubscription', () => {
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
      { _id: activation.userId },
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
