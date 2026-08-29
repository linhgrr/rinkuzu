import mongoose, { Types, type ClientSession } from 'mongoose';
import {
  BillingOrder,
  EntitlementGrant,
  FirstPurchaseClaim,
  FirstPurchaseEligibility,
  PaymentAttempt,
  PaymentTransaction,
  Promotion,
  PromotionRedemption,
  PromotionUserCounter,
} from '@/models/Billing';
import { BillingDomainError } from '@/services/billing/billing-domain';
import type { BillingQuotePayload } from '@/services/billing/quote-token';
import type {
  BillingOrderPersistenceRecord,
  PromotionPersistenceRecord,
} from '@/repositories/types/BillingPersistence';

/**
 * A promo reservation's whole life, in one place.
 *
 * It is deliberately not owned by any single repository: checkout reserves,
 * a failed provider call releases, fulfillment consumes, and a background drain
 * releases what died unpaid. Four callers, one set of counters — and counters
 * that four modules each decrement in their own way are counters that drift.
 */

type FirstPurchaseEligibilityStatus = 'available' | 'reserved' | 'consumed';

/**
 * Backfills the eligibility row for accounts that predate it, from the claims
 * and grants that already exist. Idempotent, and safe to run outside a
 * transaction: it reads three collections in parallel, which a session cannot
 * do, and a concurrent initializer simply loses the unique insert.
 */
export async function ensureFirstPurchaseEligibility(user: Types.ObjectId): Promise<void> {
  const existing = await FirstPurchaseEligibility.exists({
    user,
    eligibilityClass: 'first_purchase',
  });
  if (existing) return;

  const [consumedClaim, reservedClaim, entitlementGrant] = await Promise.all([
    FirstPurchaseClaim.findOne({
      user,
      eligibilityClass: 'first_purchase',
      status: { $in: ['consumed', 'late_consumed'] },
    })
      .sort({ consumedAt: 1, reservedAt: 1, _id: 1 })
      .select({ order: 1, consumedAt: 1 })
      .lean<{ order: Types.ObjectId; consumedAt?: Date }>()
      .exec(),
    FirstPurchaseClaim.findOne({
      user,
      eligibilityClass: 'first_purchase',
      status: 'reserved',
    })
      .sort({ reservedAt: 1 })
      .select({ order: 1, reservedAt: 1 })
      .lean<{ order: Types.ObjectId; reservedAt: Date }>()
      .exec(),
    EntitlementGrant.findOne({ user })
      .sort({ committedAt: 1, sequence: 1 })
      .select({ committedAt: 1 })
      .lean<{ committedAt: Date }>()
      .exec(),
  ]);
  const status: FirstPurchaseEligibilityStatus =
    consumedClaim || entitlementGrant ? 'consumed' : reservedClaim ? 'reserved' : 'available';
  const activeOrder = consumedClaim?.order ?? reservedClaim?.order;

  try {
    await FirstPurchaseEligibility.updateOne(
      { user, eligibilityClass: 'first_purchase' },
      {
        $setOnInsert: {
          user,
          eligibilityClass: 'first_purchase',
          status,
          ...(activeOrder ? { activeOrder } : {}),
          ...(status === 'reserved' && reservedClaim
            ? { reservedAt: reservedClaim.reservedAt }
            : {}),
          ...(status === 'consumed'
            ? {
                consumedAt:
                  consumedClaim?.consumedAt ?? entitlementGrant?.committedAt ?? new Date(),
              }
            : {}),
          version: 0,
        },
      },
      { upsert: true },
    );
  } catch (error) {
    // A concurrent initializer won the unique user/class insert.
    if ((error as { code?: number }).code !== 11000) throw error;
  }
}

async function releaseFirstPurchaseEligibility(
  user: Types.ObjectId,
  order: Types.ObjectId,
  session: ClientSession,
): Promise<void> {
  await FirstPurchaseEligibility.updateOne(
    { user, eligibilityClass: 'first_purchase', status: 'reserved', activeOrder: order },
    {
      $set: { status: 'available', releasedAt: new Date() },
      $unset: { activeOrder: 1, reservedAt: 1 },
      $inc: { version: 1 },
    },
    { session },
  );
}

export interface ReservePromotionInput {
  session: ClientSession;
  user: Types.ObjectId;
  order: Types.ObjectId;
  quote: BillingQuotePayload;
  now: Date;
}

/**
 * Takes the promotion's global slot, the per-user slot and — for a first
 * purchase promo — the account's one-time eligibility, in the checkout's own
 * transaction. Every step is conditional, so losing any of the three races
 * fails the order rather than overselling the promotion.
 */
export async function reservePromotion(input: ReservePromotionInput): Promise<void> {
  if (!input.quote.promotionId) return;
  const promotionId = new Types.ObjectId(input.quote.promotionId);
  const promotion = await Promotion.findOneAndUpdate(
    {
      _id: promotionId,
      active: true,
      archivedAt: { $exists: false },
      startsAt: { $lte: input.now },
      endsAt: { $gt: input.now },
      version: input.quote.promoVersion,
      $or: [
        { totalLimit: { $exists: false } },
        { $expr: { $lt: [{ $add: ['$reservedCount', '$redeemedCount'] }, '$totalLimit'] } },
      ],
    },
    { $inc: { reservedCount: 1 }, $set: { financialRulesLockedAt: input.now } },
    { new: true, session: input.session },
  )
    .lean<PromotionPersistenceRecord>()
    .exec();
  if (!promotion) throw new BillingDomainError('quote_stale', 'Promo availability changed');

  await PromotionUserCounter.updateOne(
    { promotion: promotionId, user: input.user },
    {
      $setOnInsert: {
        promotion: promotionId,
        user: input.user,
        reservedCount: 0,
        redeemedCount: 0,
      },
    },
    { upsert: true, session: input.session },
  );
  const userCounter = await PromotionUserCounter.findOneAndUpdate(
    {
      promotion: promotionId,
      user: input.user,
      $expr: { $lt: [{ $add: ['$reservedCount', '$redeemedCount'] }, promotion.perUserLimit] },
    },
    { $inc: { reservedCount: 1 } },
    { new: true, session: input.session },
  ).exec();
  if (!userCounter) throw new BillingDomainError('promo_not_applicable', 'Promo is unavailable');

  await PromotionRedemption.create(
    [
      {
        promotion: promotionId,
        order: input.order,
        user: input.user,
        status: 'reserved',
        discountAmount: input.quote.discountAmount,
        reservedAt: input.now,
        nextReleaseCheckAt: new Date(input.now.getTime() + 15 * 60_000),
      },
    ],
    { session: input.session },
  );

  if (promotion.eligibilityClass !== 'first_purchase') return;
  const eligibility = await FirstPurchaseEligibility.findOneAndUpdate(
    { user: input.user, eligibilityClass: 'first_purchase', status: 'available' },
    {
      $set: { status: 'reserved', activeOrder: input.order, reservedAt: input.now },
      $unset: { releasedAt: 1, consumedAt: 1 },
      $inc: { version: 1 },
    },
    { new: true, session: input.session },
  ).exec();
  if (!eligibility) throw new BillingDomainError('promo_not_applicable', 'Promo is unavailable');
  try {
    await FirstPurchaseClaim.create(
      [
        {
          user: input.user,
          eligibilityClass: 'first_purchase',
          status: 'reserved',
          order: input.order,
          reservedAt: input.now,
        },
      ],
      { session: input.session },
    );
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw new BillingDomainError('promo_not_applicable', 'Promo is unavailable');
    }
    throw error;
  }
}

/**
 * Gives back a reservation held by an order whose checkout never opened. Runs
 * inside the caller's transaction, alongside the attempt and idempotency
 * writes that record the failure.
 */
export async function releaseReservationForFailedCreate(
  orderId: Types.ObjectId,
  session: ClientSession,
): Promise<void> {
  const redemption = await PromotionRedemption.findOne({ order: orderId, status: 'reserved' })
    .session(session)
    .lean<{ promotion: Types.ObjectId; user: Types.ObjectId }>()
    .exec();
  if (!redemption) return;
  await Promotion.updateOne(
    { _id: redemption.promotion, reservedCount: { $gt: 0 } },
    { $inc: { reservedCount: -1 } },
    { session },
  );
  await PromotionUserCounter.updateOne(
    { promotion: redemption.promotion, user: redemption.user, reservedCount: { $gt: 0 } },
    { $inc: { reservedCount: -1 } },
    { session },
  );
  await PromotionRedemption.updateOne(
    { order: orderId, status: 'reserved' },
    { $set: { status: 'released', releasedAt: new Date(), releaseReason: 'create_failed' } },
    { session },
  );
  await FirstPurchaseClaim.updateOne(
    { order: orderId, status: 'reserved' },
    { $set: { status: 'released', releasedAt: new Date(), releaseReason: 'create_failed' } },
    { session },
  );
  await releaseFirstPurchaseEligibility(redemption.user, orderId, session);
}

/**
 * Releases the reservation of an order that ended without money. Returns false
 * when the order is not conclusively dead, which is the common case: a
 * reservation is only given back once no attempt can still collect on it.
 */
export async function releasePromotionReservation(
  orderId: Types.ObjectId,
  reason: string,
): Promise<boolean> {
  const firstPurchaseClaim = await FirstPurchaseClaim.findOne({ order: orderId })
    .select({ user: 1 })
    .lean<{ user: Types.ObjectId }>()
    .exec();
  if (firstPurchaseClaim) {
    await ensureFirstPurchaseEligibility(firstPurchaseClaim.user);
  }
  const session = await mongoose.startSession();
  try {
    const released = await session.withTransaction(async (): Promise<boolean> => {
      const order = await BillingOrder.findById(orderId)
        .session(session)
        .lean<{ collectionStatus: string; receivedAmount: number }>()
        .exec();
      const blockingAttempt = await PaymentAttempt.exists({
        order: orderId,
        $or: [
          { collectionStatus: { $in: ['creating', 'pending', 'partial', 'paid', 'review'] } },
          { amountPaid: { $gt: 0 } },
        ],
      }).session(session);
      const incomingPayment = await PaymentTransaction.exists({
        order: orderId,
        transactionType: 'payment',
        direction: 'incoming',
        signedAmount: { $gt: 0 },
      }).session(session);
      const terminalAttempt = await PaymentAttempt.exists({
        order: orderId,
        collectionStatus: { $in: ['cancelled', 'expired', 'failed'] },
        amountPaid: 0,
      }).session(session);
      const redemption = await PromotionRedemption.findOne({ order: orderId, status: 'reserved' })
        .session(session)
        .lean<{ _id: Types.ObjectId; promotion: Types.ObjectId; user: Types.ObjectId }>()
        .exec();
      if (
        !order ||
        order.collectionStatus !== 'unpaid' ||
        order.receivedAmount !== 0 ||
        blockingAttempt ||
        incomingPayment ||
        !terminalAttempt ||
        !redemption
      ) {
        return false;
      }

      const promotionResult = await Promotion.updateOne(
        { _id: redemption.promotion, reservedCount: { $gt: 0 } },
        { $inc: { reservedCount: -1 } },
        { session },
      );
      const userCounterResult = await PromotionUserCounter.updateOne(
        { promotion: redemption.promotion, user: redemption.user, reservedCount: { $gt: 0 } },
        { $inc: { reservedCount: -1 } },
        { session },
      );
      const redemptionResult = await PromotionRedemption.updateOne(
        { _id: redemption._id, status: 'reserved' },
        { $set: { status: 'released', releasedAt: new Date(), releaseReason: reason } },
        { session },
      );
      if (
        promotionResult.modifiedCount !== 1 ||
        userCounterResult.modifiedCount !== 1 ||
        redemptionResult.modifiedCount !== 1
      ) {
        throw new Error('Promo reservation counters are inconsistent');
      }
      await FirstPurchaseClaim.updateOne(
        { order: orderId, status: 'reserved' },
        { $set: { status: 'released', releasedAt: new Date(), releaseReason: reason } },
        { session },
      );
      await releaseFirstPurchaseEligibility(redemption.user, orderId, session);
      return true;
    });
    return released ?? false;
  } finally {
    await session.endSession();
  }
}

/**
 * Turns a reservation into a redemption when the order is fulfilled. An order
 * whose reservation was already released still redeems — the money arrived
 * late, and refusing it would give the customer their discount for free — but
 * it is counted as an overrun so the promotion's true cost stays visible.
 */
export async function consumePromotion(
  order: BillingOrderPersistenceRecord,
  session: ClientSession,
): Promise<void> {
  if (!order.promotionId) return;
  const redemption = await PromotionRedemption.findOne({ order: order._id })
    .session(session)
    .lean<{ status: 'reserved' | 'redeemed' | 'released' | 'late_redeemed' }>()
    .exec();
  if (!redemption || redemption.status === 'redeemed' || redemption.status === 'late_redeemed') {
    return;
  }
  const late = redemption.status === 'released';
  await PromotionRedemption.updateOne(
    { order: order._id, status: redemption.status },
    { $set: { status: late ? 'late_redeemed' : 'redeemed', redeemedAt: new Date() } },
    { session },
  );
  await Promotion.updateOne(
    { _id: order.promotionId },
    { $inc: { ...(late ? { overrunCount: 1 } : { reservedCount: -1 }), redeemedCount: 1 } },
    { session },
  );
  await PromotionUserCounter.updateOne(
    { promotion: order.promotionId, user: order.user },
    { $inc: { ...(late ? {} : { reservedCount: -1 }), redeemedCount: 1 } },
    { session },
  );
  if (order.eligibilityClass !== 'first_purchase') return;

  const claim = await FirstPurchaseClaim.findOne({ order: order._id })
    .session(session)
    .lean<{ _id: Types.ObjectId; status: 'reserved' | 'consumed' | 'released' | 'late_consumed' }>()
    .exec();
  if (!claim) return;
  await FirstPurchaseClaim.updateOne(
    { _id: claim._id },
    {
      $set: {
        status: claim.status === 'released' ? 'late_consumed' : 'consumed',
        consumedAt: new Date(),
      },
    },
    { session },
  );
  if (claim.status === 'reserved') {
    await FirstPurchaseEligibility.updateOne(
      {
        user: order.user,
        eligibilityClass: 'first_purchase',
        status: 'reserved',
        activeOrder: order._id,
      },
      { $set: { status: 'consumed', consumedAt: new Date() }, $inc: { version: 1 } },
      { session },
    );
    return;
  }
  if (claim.status !== 'released') return;
  await FirstPurchaseEligibility.updateOne(
    {
      user: order.user,
      eligibilityClass: 'first_purchase',
      status: { $in: ['available', 'reserved'] },
    },
    {
      $set: { status: 'consumed', activeOrder: order._id, consumedAt: new Date() },
      $unset: { releasedAt: 1, reservedAt: 1 },
      $inc: { version: 1 },
    },
    { session },
  );
}
