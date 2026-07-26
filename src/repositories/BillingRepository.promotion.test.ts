import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const mocks = vi.hoisted(() => ({
  promotionFindOneAndUpdate: vi.fn(),
  promotionUserCounterUpdateOne: vi.fn(),
  promotionUserCounterFindOneAndUpdate: vi.fn(),
  promotionRedemptionCreate: vi.fn(),
  promotionRedemptionFind: vi.fn(),
  promotionRedemptionUpdateOne: vi.fn(),
  firstPurchaseEligibilityFindOneAndUpdate: vi.fn(),
  firstPurchaseClaimCreate: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({ default: vi.fn() }));
vi.mock('@/services/billing/payos-adapter', () => ({
  BillingPayOSAdapter: class BillingPayOSAdapter {},
}));
vi.mock('@/models/Billing', () => ({
  BillingCounter: {},
  BillingOrder: {},
  EntitlementAccount: {},
  EntitlementAdjustment: {},
  EntitlementGrant: {},
  ExternalMoneyAdjustment: {},
  FirstPurchaseClaim: {
    create: mocks.firstPurchaseClaimCreate,
  },
  FirstPurchaseEligibility: {
    findOneAndUpdate: mocks.firstPurchaseEligibilityFindOneAndUpdate,
  },
  IdempotencyRecord: {},
  InternalRequestNonce: {},
  PaymentAttempt: {},
  PaymentTransaction: {},
  PaymentWebhookInbox: {},
  Promotion: {
    findOneAndUpdate: mocks.promotionFindOneAndUpdate,
  },
  PromotionRedemption: {
    create: mocks.promotionRedemptionCreate,
    find: mocks.promotionRedemptionFind,
    updateOne: mocks.promotionRedemptionUpdateOne,
  },
  PromotionUserCounter: {
    updateOne: mocks.promotionUserCounterUpdateOne,
    findOneAndUpdate: mocks.promotionUserCounterFindOneAndUpdate,
  },
}));

import { BillingRepository } from './BillingRepository';

type PromotionRepositoryInternals = {
  reservePromotion(input: {
    session: object;
    user: Types.ObjectId;
    order: Types.ObjectId;
    quote: {
      promotionId: string;
      promoVersion: number;
      discountAmount: number;
    };
    now: Date;
  }): Promise<void>;
  releaseDuePromotionReservations(limit: number): Promise<number>;
  releasePromotionReservation(orderId: Types.ObjectId, reason: string): Promise<boolean>;
};

function getPrivateMethod<K extends keyof PromotionRepositoryInternals>(
  repository: BillingRepository,
  name: K,
): PromotionRepositoryInternals[K] {
  const method = Reflect.get(repository, name);
  if (typeof method !== 'function') {
    throw new Error(`Missing repository method: ${String(name)}`);
  }
  return method.bind(repository) as PromotionRepositoryInternals[K];
}

function execChain<T>(value: T) {
  return { exec: vi.fn().mockResolvedValue(value) };
}

function leanExecChain<T>(value: T) {
  return {
    lean: vi.fn().mockReturnValue(execChain(value)),
  };
}

describe('BillingRepository promotion invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.promotionUserCounterUpdateOne.mockResolvedValue({ acknowledged: true });
    mocks.promotionRedemptionCreate.mockResolvedValue([]);
    mocks.firstPurchaseClaimCreate.mockResolvedValue([]);
  });

  it('acquires the global first-purchase singleton before inserting claim history', async () => {
    const promotionId = new Types.ObjectId();
    const user = new Types.ObjectId();
    const order = new Types.ObjectId();
    const promotion = {
      _id: promotionId,
      eligibilityClass: 'first_purchase',
      perUserLimit: 1,
    };
    mocks.promotionFindOneAndUpdate.mockReturnValue(leanExecChain(promotion));
    mocks.promotionUserCounterFindOneAndUpdate.mockReturnValue(execChain({}));
    mocks.firstPurchaseEligibilityFindOneAndUpdate.mockReturnValue(execChain(null));
    const repository = new BillingRepository();
    const reservePromotion = getPrivateMethod(repository, 'reservePromotion');

    await expect(
      reservePromotion({
        session: {},
        user,
        order,
        quote: {
          promotionId: promotionId.toString(),
          promoVersion: 1,
          discountAmount: 37_050,
        },
        now: new Date('2026-07-26T00:00:00Z'),
      }),
    ).rejects.toMatchObject({
      code: 'promo_not_applicable',
    });

    expect(mocks.firstPurchaseEligibilityFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        user,
        eligibilityClass: 'first_purchase',
        status: 'available',
      }),
      expect.any(Object),
      expect.objectContaining({ session: {} }),
    );
    expect(mocks.firstPurchaseClaimCreate).not.toHaveBeenCalled();
  });

  it('keeps retrying due releases and does not let a blocked reservation starve later work', async () => {
    const blockedOrder = new Types.ObjectId();
    const releasableOrder = new Types.ObjectId();
    const reservedAt = new Date('2026-07-26T00:00:00Z');
    mocks.promotionRedemptionFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(
            leanExecChain([
              {
                _id: new Types.ObjectId(),
                order: blockedOrder,
                reservedAt,
              },
              {
                _id: new Types.ObjectId(),
                order: releasableOrder,
                reservedAt,
              },
            ]),
          ),
        }),
      }),
    });
    const repository = new BillingRepository();
    const releasePromotionReservation = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    Object.defineProperty(repository, 'releasePromotionReservation', {
      configurable: true,
      value: releasePromotionReservation,
    });
    const releaseDuePromotionReservations = getPrivateMethod(
      repository,
      'releaseDuePromotionReservations',
    );

    await expect(releaseDuePromotionReservations(10)).resolves.toBe(1);

    expect(releasePromotionReservation).toHaveBeenCalledTimes(2);
    expect(mocks.promotionRedemptionUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'reserved' }),
      expect.objectContaining({
        $inc: { releaseAttemptCount: 1 },
      }),
    );
  });

  it('records a release failure and continues processing later reservations', async () => {
    const failedRedemption = new Types.ObjectId();
    const failedOrder = new Types.ObjectId();
    const nextOrder = new Types.ObjectId();
    const reservedAt = new Date('2026-07-26T00:00:00Z');
    mocks.promotionRedemptionFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(
            leanExecChain([
              {
                _id: failedRedemption,
                order: failedOrder,
                reservedAt,
              },
              {
                _id: new Types.ObjectId(),
                order: nextOrder,
                reservedAt,
              },
            ]),
          ),
        }),
      }),
    });
    const repository = new BillingRepository();
    const releasePromotionReservation = vi
      .fn()
      .mockRejectedValueOnce(new Error('write conflict'))
      .mockResolvedValueOnce(true);
    Object.defineProperty(repository, 'releasePromotionReservation', {
      configurable: true,
      value: releasePromotionReservation,
    });
    const releaseDuePromotionReservations = getPrivateMethod(
      repository,
      'releaseDuePromotionReservations',
    );

    await expect(releaseDuePromotionReservations(10)).resolves.toBe(1);

    expect(releasePromotionReservation).toHaveBeenCalledTimes(2);
    expect(mocks.promotionRedemptionUpdateOne).toHaveBeenCalledWith(
      { _id: failedRedemption, status: 'reserved' },
      expect.objectContaining({
        $set: expect.objectContaining({ lastReleaseError: 'write conflict' }),
        $inc: { releaseAttemptCount: 1 },
      }),
    );
  });
});
