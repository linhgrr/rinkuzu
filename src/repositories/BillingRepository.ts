import crypto from 'crypto';
import mongoose, { Types, type ClientSession } from 'mongoose';
import connectDB from '@/lib/mongoose';
import Plan from '@/models/Plan';
import Subscription from '@/models/Subscription';
import User from '@/models/User';
import {
  BillingCounter,
  BillingOrder,
  EntitlementAccount,
  EntitlementAdjustment,
  EntitlementGrant,
  ExternalMoneyAdjustment,
  FirstPurchaseClaim,
  FirstPurchaseEligibility,
  IdempotencyRecord,
  PaymentAttempt,
  PaymentTransaction,
  PaymentWebhookInbox,
  Promotion,
  PromotionRedemption,
  PromotionUserCounter,
  InternalRequestNonce,
} from '@/models/Billing';
import type {
  BillingOrderMutationResult,
  BillingOrderView,
  BillingQuoteResult,
  CreateBillingOrderInput,
  CreateExternalMoneyAdjustmentInput,
  CreatePromotionInput,
  IBillingRepository,
  InboxProcessingResult,
  PersistedWebhookResult,
  ReconciliationResult,
  PromotionAdminView,
  VerifiedPayOSWebhookInput,
} from '@/interfaces/repositories/IBillingRepository';
import {
  addCalendarMonths,
  BillingDomainError,
  calculateDiscount,
  canApplyCollectionTransition,
  hashIdempotencyRequest,
  normalizePromoCode,
  reconciliationDelayMs,
  replayEntitlement,
  withJitter,
} from '@/services/billing/billing-domain';
import { billingConfig } from '@/services/billing/billing-config';
import {
  issueQuoteToken,
  verifyQuoteToken,
  type BillingQuotePayload,
} from '@/services/billing/quote-token';
import {
  BillingPayOSAdapter,
  type ProviderCreateOutcome,
  type ProviderPaymentSnapshot,
} from '@/services/billing/payos-adapter';

type PlanLean = {
  _id: string;
  name: string;
  price: number;
  duration: string;
  isActive: boolean;
  updatedAt: Date;
};

type PromotionLean = {
  _id: Types.ObjectId;
  code: string;
  normalizedCode: string;
  description?: string;
  kind: 'percentage' | 'fixed';
  percentageOff?: number;
  percentageCap?: number;
  fixedAmount?: number;
  currency?: 'VND';
  minimumSubtotal: number;
  eligibilityClass: 'public' | 'first_purchase';
  totalLimit?: number;
  perUserLimit: number;
  reservedCount: number;
  redeemedCount: number;
  overrunCount: number;
  startsAt: Date;
  endsAt: Date;
  active: boolean;
  archivedAt?: Date;
  version: number;
};

type OrderLean = {
  _id: Types.ObjectId;
  publicId: string;
  orderCode: number;
  user: Types.ObjectId;
  planId: string;
  planName: string;
  currency: 'VND';
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  receivedAmount: number;
  excessAmount: number;
  excessResolution: string;
  durationUnit: 'day' | 'month';
  durationValue: number;
  pricingVersion: number;
  promoVersion?: number;
  termsVersion: string;
  promotionId?: Types.ObjectId;
  promotionCode?: string;
  eligibilityClass?: 'first_purchase';
  collectionStatus: string;
  fulfillmentStatus: string;
  settlementStatus: string;
  fulfilledAt?: Date;
  providerPaidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

type AttemptLean = {
  _id: Types.ObjectId;
  order: Types.ObjectId;
  provider: 'payos';
  providerAccountId: string;
  environment: 'test' | 'production';
  externalOrderId?: string;
  paymentLinkId?: string;
  checkoutUrl?: string;
  currency: 'VND';
  requestedAmount: number;
  amountPaid: number;
  amountRemaining: number;
  collectionStatus: string;
  activeForCheckout: boolean;
  createOutcome: string;
  expiresAt: Date;
  terminalConfirmedAt?: Date;
  nextReconcileAt: Date;
  reconcileCount: number;
  version: number;
  createdAt: Date;
};

interface PlanDuration {
  durationUnit: 'month';
  durationValue: number;
}

interface UserSubscriptionLean {
  isActive?: boolean;
  endDate?: Date;
}

interface UserBillingStateLean {
  subscription?: UserSubscriptionLean;
}

interface IdempotencyResponseSnapshotLean {
  code?: string;
  message?: string;
}

interface IdempotencyLean {
  requestHash: string;
  order?: Types.ObjectId;
  status: string;
  responseStatus?: number;
  responseBodySnapshot?: IdempotencyResponseSnapshotLean;
}

interface ComputedQuote {
  payload: BillingQuotePayload;
  plan: PlanLean;
  promotion: PromotionLean | null;
}

interface ReservePromotionInput {
  session: ClientSession;
  user: Types.ObjectId;
  order: Types.ObjectId;
  quote: BillingQuotePayload;
  now: Date;
}

type ExistingWebhookPayload = {
  amount?: number;
  currency?: string;
};

type ExistingWebhookRecord = {
  _id: Types.ObjectId;
  rawPayloadHash: string;
  orderCode?: number;
  paymentLinkId?: string;
  normalizedPayload?: ExistingWebhookPayload;
};

type PayerSignalHash = {
  hash: string;
  keyVersion: string;
  normalizedVersion: number;
};

type PayerSignalInput = {
  bankId?: string | null;
  accountNumber?: string | null;
};

type CreateProviderCheckoutInput = {
  orderCode: number;
  amount: number;
  description: string;
  publicId: string;
  baseUrl: string;
  buyerEmail: string;
  now: Date;
};

type FirstPurchaseEligibilityStatus = 'available' | 'reserved' | 'consumed';

function objectId(value: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new BillingDomainError('invalid_user', 'User identity is invalid', 401);
  }
  return new Types.ObjectId(value);
}

function requireObjectId(value: Types.ObjectId | null): Types.ObjectId {
  if (!value) {
    throw new BillingDomainError('payment_processing_failed', 'Order was not created', 500);
  }
  return value;
}

function parsePlanDuration(duration: string): PlanDuration {
  const match = /^P(\d+)M$/.exec(duration);
  if (!match?.[1]) {
    throw new BillingDomainError('unsupported_plan_duration', 'Plan duration is unsupported', 400);
  }
  return { durationUnit: 'month', durationValue: Number(match[1]) };
}

function quoteMatches(left: BillingQuotePayload, right: BillingQuotePayload): boolean {
  const fields: Array<keyof BillingQuotePayload> = [
    'userId',
    'planId',
    'currency',
    'baseAmount',
    'promotionId',
    'promotionCode',
    'discountAmount',
    'finalAmount',
    'durationUnit',
    'durationValue',
    'pricingVersion',
    'promoVersion',
    'termsVersion',
  ];
  return fields.every((field) => left[field] === right[field]);
}

function payosStatus(snapshot: ProviderPaymentSnapshot): string {
  if (
    snapshot.status === 'PAID' &&
    snapshot.amountPaid >= snapshot.amount &&
    snapshot.amountRemaining === 0
  ) {
    return 'paid';
  }
  if (snapshot.amountPaid > 0) return 'partial';
  if (snapshot.status === 'CANCELLED') return 'cancelled';
  if (snapshot.status === 'EXPIRED') return 'expired';
  if (snapshot.status === 'PENDING' || snapshot.status === 'PROCESSING') return 'pending';
  return 'review';
}

export class BillingRepository implements IBillingRepository {
  constructor(private readonly payos = new BillingPayOSAdapter()) {}

  private async ensureFirstPurchaseEligibility(user: Types.ObjectId): Promise<void> {
    const existing = await FirstPurchaseEligibility.exists({
      user,
      eligibilityClass: 'first_purchase',
    });
    if (existing) return;

    const [consumedClaim, reservedClaim] = await Promise.all([
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
    ]);
    const status: FirstPurchaseEligibilityStatus = consumedClaim
      ? 'consumed'
      : reservedClaim
        ? 'reserved'
        : 'available';
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
              ? { consumedAt: consumedClaim?.consumedAt ?? new Date() }
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

  private async releaseFirstPurchaseEligibility(
    user: Types.ObjectId,
    order: Types.ObjectId,
    session: ClientSession,
  ): Promise<void> {
    await FirstPurchaseEligibility.updateOne(
      {
        user,
        eligibilityClass: 'first_purchase',
        status: 'reserved',
        activeOrder: order,
      },
      {
        $set: {
          status: 'available',
          releasedAt: new Date(),
        },
        $unset: {
          activeOrder: 1,
          reservedAt: 1,
        },
        $inc: { version: 1 },
      },
      { session },
    );
  }

  private async computeQuote(
    userId: string,
    planId: string,
    promoCode: string | null,
    now = new Date(),
  ): Promise<ComputedQuote> {
    await connectDB();
    const userObjectId = objectId(userId);
    const [plan, entitlement, user] = await Promise.all([
      Plan.findOne({ _id: planId, isActive: true }).lean<PlanLean>().exec(),
      EntitlementAccount.findOne({ user: userObjectId }).lean<{ perpetual: boolean }>().exec(),
      User.findById(userObjectId)
        .select({ 'subscription.isActive': 1, 'subscription.endDate': 1 })
        .lean<UserBillingStateLean>()
        .exec(),
    ]);
    if (!plan) throw new BillingDomainError('plan_not_found', 'Plan is not available', 404);
    if (
      entitlement?.perpetual === true ||
      (user?.subscription?.isActive === true && !user.subscription.endDate)
    ) {
      throw new BillingDomainError(
        'already_has_perpetual_entitlement',
        'This account already has perpetual Premium',
      );
    }

    let promotion: PromotionLean | null = null;
    let discountAmount = 0;
    let finalAmount = plan.price;
    if (promoCode) {
      const normalizedCode = normalizePromoCode(promoCode);
      promotion = await Promotion.findOne({ normalizedCode }).lean<PromotionLean>().exec();
      if (
        !promotion ||
        !promotion.active ||
        promotion.archivedAt ||
        promotion.startsAt.getTime() > now.getTime() ||
        promotion.endsAt.getTime() <= now.getTime() ||
        (promotion.currency && promotion.currency !== 'VND') ||
        (promotion.totalLimit !== undefined &&
          promotion.reservedCount + promotion.redeemedCount >= promotion.totalLimit)
      ) {
        throw new BillingDomainError('promo_not_applicable', 'Promo code is not applicable');
      }

      const userCounter = await PromotionUserCounter.findOne({
        promotion: promotion._id,
        user: userObjectId,
      })
        .lean<{ reservedCount: number; redeemedCount: number }>()
        .exec();
      if (
        (userCounter?.reservedCount ?? 0) + (userCounter?.redeemedCount ?? 0) >=
        promotion.perUserLimit
      ) {
        throw new BillingDomainError('promo_not_applicable', 'Promo code is not applicable');
      }
      if (promotion.eligibilityClass === 'first_purchase') {
        const [paidOrder, legacyPaidSubscription, claim, eligibility] = await Promise.all([
          BillingOrder.exists({
            user: userObjectId,
            receivedAmount: { $gt: 0 },
          }),
          Subscription.exists({ user: userObjectId, status: 'completed' }),
          FirstPurchaseClaim.exists({
            user: userObjectId,
            eligibilityClass: 'first_purchase',
            status: { $in: ['reserved', 'consumed', 'late_consumed'] },
          }),
          FirstPurchaseEligibility.exists({
            user: userObjectId,
            eligibilityClass: 'first_purchase',
            status: { $in: ['reserved', 'consumed'] },
          }),
        ]);
        if (paidOrder || legacyPaidSubscription || claim || eligibility) {
          throw new BillingDomainError('promo_not_applicable', 'Promo code is not applicable');
        }
      }

      const calculated =
        promotion.kind === 'fixed'
          ? calculateDiscount(plan.price, {
              kind: 'fixed',
              fixedAmount: promotion.fixedAmount ?? 0,
              minimumSubtotal: promotion.minimumSubtotal,
            })
          : calculateDiscount(plan.price, {
              kind: 'percentage',
              percentageOff: promotion.percentageOff ?? 0,
              ...(promotion.percentageCap !== undefined
                ? { percentageCap: promotion.percentageCap }
                : {}),
              minimumSubtotal: promotion.minimumSubtotal,
            });
      discountAmount = calculated.discountAmount;
      finalAmount = calculated.finalAmount;
    }

    const duration = parsePlanDuration(plan.duration);
    const issuedAt = now.getTime();
    return {
      plan,
      promotion,
      payload: {
        userId,
        planId: plan._id,
        currency: 'VND',
        baseAmount: plan.price,
        promotionId: promotion?._id.toString() ?? null,
        promotionCode: promotion?.normalizedCode ?? null,
        discountAmount,
        finalAmount,
        ...duration,
        pricingVersion: Math.max(1, Math.floor(plan.updatedAt.getTime() / 1_000)),
        promoVersion: promotion?.version ?? null,
        termsVersion: billingConfig.termsVersion(),
        issuedAt,
        expiresAt: issuedAt + 5 * 60_000,
      },
    };
  }

  async quote(
    userId: string,
    planId: string,
    promoCode?: string | null,
  ): Promise<BillingQuoteResult> {
    const computed = await this.computeQuote(userId, planId, promoCode ?? null);
    const key = billingConfig.quoteKeys()[0];
    if (!key) throw new BillingDomainError('billing_configuration_error', 'No quote key', 500);
    return {
      token: issueQuoteToken(computed.payload, key),
      quote: computed.payload,
      plan: { id: computed.plan._id, name: computed.plan.name },
    };
  }

  private async nextOrderCode(session: ClientSession): Promise<number> {
    const counter = await BillingCounter.findOneAndUpdate(
      { _id: 'payos-order-code' },
      { $inc: { value: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: false, session },
    )
      .lean<{ value: number }>()
      .exec();
    if (!counter || !Number.isSafeInteger(counter.value) || counter.value <= 0) {
      throw new BillingDomainError('order_code_unavailable', 'Could not allocate order code', 500);
    }
    return counter.value;
  }

  private async reservePromotion(input: ReservePromotionInput): Promise<void> {
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
      {
        $inc: { reservedCount: 1 },
        $set: { financialRulesLockedAt: input.now },
      },
      { new: true, session: input.session },
    )
      .lean<PromotionLean>()
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
      {
        $inc: { reservedCount: 1 },
      },
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

    if (promotion.eligibilityClass === 'first_purchase') {
      const eligibility = await FirstPurchaseEligibility.findOneAndUpdate(
        {
          user: input.user,
          eligibilityClass: 'first_purchase',
          status: 'available',
        },
        {
          $set: {
            status: 'reserved',
            activeOrder: input.order,
            reservedAt: input.now,
          },
          $unset: {
            releasedAt: 1,
            consumedAt: 1,
          },
          $inc: { version: 1 },
        },
        { new: true, session: input.session },
      ).exec();
      if (!eligibility) {
        throw new BillingDomainError('promo_not_applicable', 'Promo is unavailable');
      }
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
  }

  async createOrder(input: CreateBillingOrderInput): Promise<BillingOrderMutationResult> {
    if (!/^[A-Za-z0-9._:-]{16,200}$/.test(input.idempotencyKey)) {
      throw new BillingDomainError('invalid_idempotency_key', 'Idempotency key is invalid', 400);
    }
    await connectDB();
    const user = objectId(input.userId);
    const requestHash = hashIdempotencyRequest({
      endpoint: '/api/v1/billing/orders',
      apiVersion: 'v1',
      payload: { quoteToken: input.quoteToken },
    });
    const existing = await IdempotencyRecord.findOne({
      user,
      endpoint: '/api/v1/billing/orders',
      apiVersion: 'v1',
      idempotencyKey: input.idempotencyKey,
    })
      .lean<IdempotencyLean>()
      .exec();
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new BillingDomainError(
          'idempotency_conflict',
          'Idempotency key was used for a different request',
        );
      }
      if (!existing.order) {
        throw new BillingDomainError('payment_processing', 'Payment request is processing', 202);
      }
      if (existing.status === 'failed_deterministic') {
        throw new BillingDomainError(
          existing.responseBodySnapshot?.code ?? 'payment_create_failed',
          existing.responseBodySnapshot?.message ?? 'Payment creation failed',
          existing.responseStatus ?? 422,
        );
      }
      return {
        status: existing.status === 'completed' ? 200 : 202,
        order: await this.getOrderById(input.userId, existing.order.toString()),
      };
    }

    if (!billingConfig.payosCreateEnabled()) {
      throw new BillingDomainError(
        'payment_creation_disabled',
        'Payment creation is temporarily paused',
        503,
      );
    }
    const signedQuote = verifyQuoteToken(input.quoteToken, billingConfig.quoteKeys());
    if (signedQuote.userId !== input.userId) {
      throw new BillingDomainError('invalid_quote', 'Quote belongs to another user', 403);
    }
    const recomputed = await this.computeQuote(
      input.userId,
      signedQuote.planId,
      signedQuote.promotionCode,
    );
    if (!quoteMatches(signedQuote, recomputed.payload)) {
      throw new BillingDomainError('quote_stale', 'Price or promotion changed');
    }
    if (recomputed.promotion?.eligibilityClass === 'first_purchase') {
      await this.ensureFirstPurchaseEligibility(user);
    }

    const baseUrl = billingConfig.siteUrl();
    if (!baseUrl) {
      throw new BillingDomainError('billing_configuration_error', 'Site URL is missing', 500);
    }
    const buyerEmail = await this.userEmail(user);
    const session = await mongoose.startSession();
    let orderId: Types.ObjectId | null = null;
    let attemptId: Types.ObjectId | null = null;
    let orderCode = 0;
    const publicId = crypto.randomUUID();
    const now = new Date();
    try {
      await session.withTransaction(async () => {
        orderId = new Types.ObjectId();
        attemptId = new Types.ObjectId();
        orderCode = await this.nextOrderCode(session);
        await IdempotencyRecord.create(
          [
            {
              user,
              endpoint: '/api/v1/billing/orders',
              apiVersion: 'v1',
              idempotencyKey: input.idempotencyKey,
              requestHash,
              order: orderId,
              status: 'processing',
              responseVersion: 1,
            },
          ],
          { session },
        );
        await this.reservePromotion({
          session,
          user,
          order: orderId,
          quote: recomputed.payload,
          now,
        });
        await BillingOrder.create(
          [
            {
              _id: orderId,
              publicId,
              orderCode,
              user,
              planId: recomputed.plan._id,
              planName: recomputed.plan.name,
              currency: 'VND',
              baseAmount: recomputed.payload.baseAmount,
              discountAmount: recomputed.payload.discountAmount,
              finalAmount: recomputed.payload.finalAmount,
              receivedAmount: 0,
              excessAmount: 0,
              durationUnit: recomputed.payload.durationUnit,
              durationValue: recomputed.payload.durationValue,
              pricingVersion: recomputed.payload.pricingVersion,
              ...(recomputed.payload.promoVersion
                ? { promoVersion: recomputed.payload.promoVersion }
                : {}),
              termsVersion: recomputed.payload.termsVersion,
              ...(recomputed.payload.promotionId
                ? {
                    promotionId: new Types.ObjectId(recomputed.payload.promotionId),
                    promotionCode: recomputed.payload.promotionCode,
                  }
                : {}),
              ...(recomputed.promotion?.eligibilityClass === 'first_purchase'
                ? { eligibilityClass: 'first_purchase' }
                : {}),
            },
          ],
          { session },
        );
        await PaymentAttempt.create(
          [
            {
              _id: attemptId,
              order: orderId,
              provider: 'payos',
              providerAccountId: billingConfig.providerAccountId(),
              environment: billingConfig.providerEnvironment(),
              externalOrderId: orderCode.toString(),
              currency: 'VND',
              requestedAmount: recomputed.payload.finalAmount,
              amountPaid: 0,
              amountRemaining: recomputed.payload.finalAmount,
              collectionStatus: 'creating',
              activeForCheckout: true,
              createOutcome: 'not_started',
              expiresAt: new Date(now.getTime() + 15 * 60_000),
              nextReconcileAt: now,
            },
          ],
          { session },
        );
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        const raced = await IdempotencyRecord.findOne({
          user,
          endpoint: '/api/v1/billing/orders',
          apiVersion: 'v1',
          idempotencyKey: input.idempotencyKey,
        })
          .lean<IdempotencyLean>()
          .exec();
        if (raced?.requestHash === requestHash && raced.order) {
          if (raced.status === 'failed_deterministic') {
            throw new BillingDomainError(
              raced.responseBodySnapshot?.code ?? 'payment_create_failed',
              raced.responseBodySnapshot?.message ?? 'Payment creation failed',
              raced.responseStatus ?? 422,
            );
          }
          return {
            status: raced.status === 'completed' ? 200 : 202,
            order: await this.getOrderById(input.userId, raced.order.toString()),
          };
        }
      }
      throw error;
    } finally {
      await session.endSession();
    }
    const createdOrderId = requireObjectId(orderId);
    const createdAttemptId = requireObjectId(attemptId);

    const createOutcome = await this.createProviderCheckout({
      orderCode,
      amount: recomputed.payload.finalAmount,
      description: recomputed.plan.name.slice(0, 25),
      publicId,
      baseUrl,
      buyerEmail,
      now,
    });

    let outcome = createOutcome;
    if (createOutcome.kind === 'duplicate') {
      const snapshot = await this.payos.getPayment(orderCode);
      if (snapshot) {
        outcome = {
          kind: 'created',
          paymentLinkId: snapshot.id,
          checkoutUrl: `https://pay.payos.vn/web/${snapshot.id}`,
        };
      } else {
        outcome = {
          kind: 'indeterminate',
          message: 'Provider reported a duplicate order that is not queryable yet',
        };
      }
    }
    if (outcome.kind === 'created') {
      await this.markAttemptCreated(
        createdAttemptId,
        outcome.paymentLinkId,
        outcome.checkoutUrl,
        now,
      );
      await IdempotencyRecord.updateOne(
        { order: createdOrderId, status: 'processing' },
        {
          $set: {
            status: 'completed',
            responseStatus: 201,
            responseBodySnapshot: { orderId: createdOrderId.toString() },
          },
        },
      );
      return {
        status: 201,
        order: await this.getOrderById(input.userId, createdOrderId.toString()),
      };
    }

    if (outcome.kind === 'definite_failure') {
      await this.failOrderCreation(createdOrderId, createdAttemptId, outcome.message);
      throw new BillingDomainError('payment_create_failed', outcome.message, 422);
    }

    const indeterminateMessage =
      'message' in outcome ? outcome.message : 'Provider response is indeterminate';
    await PaymentAttempt.updateOne(
      { _id: createdAttemptId },
      {
        $set: {
          createOutcome: 'indeterminate',
          lastProviderError: indeterminateMessage,
          nextReconcileAt: new Date(now.getTime() + 60_000),
        },
        $inc: { version: 1 },
      },
    );
    return { status: 202, order: await this.getOrderById(input.userId, createdOrderId.toString()) };
  }

  private async userEmail(userId: Types.ObjectId): Promise<string> {
    const user = await User.findById(userId).select({ email: 1 }).lean<{ email: string }>().exec();
    if (!user) throw new BillingDomainError('user_not_found', 'User not found', 404);
    return user.email;
  }

  private createProviderCheckout(
    input: CreateProviderCheckoutInput,
  ): Promise<ProviderCreateOutcome> {
    const callbackUrl = `${input.baseUrl}/checkout?order=${input.publicId}`;
    return this.payos.createCheckout({
      orderCode: input.orderCode,
      amount: input.amount,
      description: input.description,
      returnUrl: callbackUrl,
      cancelUrl: callbackUrl,
      expiredAt: Math.floor((input.now.getTime() + 15 * 60_000) / 1_000),
      buyerEmail: input.buyerEmail,
    });
  }

  private async markAttemptCreated(
    attemptId: Types.ObjectId,
    paymentLinkId: string,
    checkoutUrl: string,
    now: Date,
  ): Promise<void> {
    const result = await PaymentAttempt.updateOne(
      { _id: attemptId, collectionStatus: 'creating' },
      {
        $set: {
          paymentLinkId,
          checkoutUrl,
          collectionStatus: 'pending',
          createOutcome: 'created',
          nextReconcileAt: new Date(now.getTime() + 60_000),
        },
        $inc: { version: 1 },
      },
    );
    if (result.matchedCount === 1) return;
    const current = await PaymentAttempt.findById(attemptId)
      .lean<{ paymentLinkId?: string; collectionStatus: string }>()
      .exec();
    if (current?.paymentLinkId || current?.collectionStatus !== 'creating') return;
    await PaymentAttempt.updateOne(
      { _id: attemptId, collectionStatus: 'creating' },
      {
        $set: {
          paymentLinkId,
          checkoutUrl,
          collectionStatus: 'pending',
          createOutcome: 'created',
        },
        $inc: { version: 1 },
      },
    );
  }

  private async failOrderCreation(
    orderId: Types.ObjectId,
    attemptId: Types.ObjectId,
    message: string,
  ): Promise<void> {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const redemption = await PromotionRedemption.findOne({
          order: orderId,
          status: 'reserved',
        })
          .session(session)
          .lean<{ promotion: Types.ObjectId; user: Types.ObjectId }>()
          .exec();
        if (redemption) {
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
            {
              $set: { status: 'released', releasedAt: new Date(), releaseReason: 'create_failed' },
            },
            { session },
          );
          await FirstPurchaseClaim.updateOne(
            { order: orderId, status: 'reserved' },
            {
              $set: {
                status: 'released',
                releasedAt: new Date(),
                releaseReason: 'create_failed',
              },
            },
            { session },
          );
          await this.releaseFirstPurchaseEligibility(redemption.user, orderId, session);
        }
        await PaymentAttempt.updateOne(
          { _id: attemptId },
          {
            $set: {
              collectionStatus: 'failed',
              activeForCheckout: false,
              createOutcome: 'definite_failure',
              terminalConfirmedAt: new Date(),
              lastProviderError: message,
            },
          },
          { session },
        );
        await BillingOrder.updateOne(
          { _id: orderId },
          { $set: { collectionStatus: 'review' } },
          { session },
        );
        await IdempotencyRecord.updateOne(
          { order: orderId },
          {
            $set: {
              status: 'failed_deterministic',
              responseStatus: 422,
              responseBodySnapshot: { code: 'payment_create_failed', message },
            },
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
  }

  async getOrderByPublicId(userId: string, publicId: string): Promise<BillingOrderView> {
    await connectDB();
    const order = await BillingOrder.findOne({ publicId, user: objectId(userId) })
      .lean<OrderLean>()
      .exec();
    if (!order) throw new BillingDomainError('order_not_found', 'Order not found', 404);
    return this.toOrderView(order);
  }

  async verifyOrder(userId: string, publicId: string): Promise<BillingOrderView> {
    await connectDB();
    const order = await BillingOrder.findOne({ publicId, user: objectId(userId) })
      .lean<OrderLean>()
      .exec();
    if (!order) throw new BillingDomainError('order_not_found', 'Order not found', 404);
    const attempt = await PaymentAttempt.findOne({ order: order._id })
      .sort({ createdAt: -1 })
      .lean<AttemptLean>()
      .exec();
    if (attempt) await this.reconcileAttempt(attempt);
    return this.getOrderByPublicId(userId, publicId);
  }

  async cancelOrder(userId: string, publicId: string): Promise<BillingOrderView> {
    await connectDB();
    const order = await BillingOrder.findOne({ publicId, user: objectId(userId) })
      .lean<OrderLean>()
      .exec();
    if (!order) throw new BillingDomainError('order_not_found', 'Order not found', 404);
    if (order.collectionStatus === 'paid' || order.collectionStatus === 'overpaid') {
      throw new BillingDomainError('payment_state_conflict', 'A paid order cannot be cancelled');
    }
    const attempt = await PaymentAttempt.findOne({
      order: order._id,
      activeForCheckout: true,
    })
      .sort({ createdAt: -1 })
      .lean<AttemptLean>()
      .exec();
    if (!attempt?.externalOrderId) {
      throw new BillingDomainError('payment_state_conflict', 'No cancellable payment attempt');
    }
    const providerOrderCode = Number(attempt.externalOrderId);
    if (!Number.isSafeInteger(providerOrderCode)) {
      throw new BillingDomainError('payment_state_conflict', 'Payment attempt is invalid');
    }
    await this.payos.cancelPayment(providerOrderCode, 'User requested cancellation');
    await this.reconcileAttempt(attempt);
    return this.getOrderByPublicId(userId, publicId);
  }

  async createReplacementAttempt(
    userId: string,
    publicId: string,
  ): Promise<BillingOrderMutationResult> {
    if (!billingConfig.payosCreateEnabled()) {
      throw new BillingDomainError(
        'payment_creation_disabled',
        'Payment creation is temporarily paused',
        503,
      );
    }
    await connectDB();
    const order = await BillingOrder.findOne({ publicId, user: objectId(userId) })
      .lean<OrderLean>()
      .exec();
    if (!order) throw new BillingDomainError('order_not_found', 'Order not found', 404);
    if (order.collectionStatus !== 'unpaid') {
      throw new BillingDomainError(
        'payment_state_conflict',
        'A replacement attempt requires an unpaid order',
      );
    }
    const previous = await PaymentAttempt.findOne({ order: order._id })
      .sort({ createdAt: -1 })
      .lean<AttemptLean>()
      .exec();
    if (
      !previous ||
      !['cancelled', 'expired', 'failed'].includes(previous.collectionStatus) ||
      previous.createOutcome === 'indeterminate' ||
      previous.amountPaid !== 0 ||
      !previous.terminalConfirmedAt ||
      Date.now() - previous.terminalConfirmedAt.getTime() < 30 * 60_000
    ) {
      throw new BillingDomainError(
        'payment_attempt_blocked',
        'The previous payment attempt is not safely replaceable',
      );
    }
    const transactionExists = await PaymentTransaction.exists({
      attempt: previous._id,
      transactionType: 'payment',
    });
    if (transactionExists) {
      throw new BillingDomainError(
        'payment_attempt_blocked',
        'The previous attempt has received money',
      );
    }

    const baseUrl = billingConfig.siteUrl();
    if (!baseUrl) {
      throw new BillingDomainError('billing_configuration_error', 'Site URL is missing', 500);
    }
    const buyerEmail = await this.userEmail(order.user);
    const session = await mongoose.startSession();
    const attemptId = new Types.ObjectId();
    let orderCode = 0;
    const now = new Date();
    try {
      await session.withTransaction(async () => {
        orderCode = await this.nextOrderCode(session);
        const deactivated = await PaymentAttempt.updateOne(
          {
            _id: previous._id,
            collectionStatus: { $in: ['cancelled', 'expired', 'failed'] },
            amountPaid: 0,
          },
          { $set: { activeForCheckout: false } },
          { session },
        );
        if (deactivated.matchedCount !== 1) {
          throw new BillingDomainError(
            'payment_state_conflict',
            'Payment attempt changed concurrently',
          );
        }
        await PaymentAttempt.create(
          [
            {
              _id: attemptId,
              order: order._id,
              provider: 'payos',
              providerAccountId: billingConfig.providerAccountId(),
              environment: billingConfig.providerEnvironment(),
              externalOrderId: orderCode.toString(),
              currency: order.currency,
              requestedAmount: order.finalAmount,
              amountPaid: 0,
              amountRemaining: order.finalAmount,
              collectionStatus: 'creating',
              activeForCheckout: true,
              createOutcome: 'not_started',
              expiresAt: new Date(now.getTime() + 15 * 60_000),
              nextReconcileAt: now,
            },
          ],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    const createOutcome = await this.createProviderCheckout({
      orderCode,
      amount: order.finalAmount,
      description: order.planName.slice(0, 25),
      publicId: order.publicId,
      baseUrl,
      buyerEmail,
      now,
    });
    let outcome = createOutcome;
    if (createOutcome.kind === 'duplicate') {
      const snapshot = await this.payos.getPayment(orderCode);
      outcome = snapshot
        ? {
            kind: 'created',
            paymentLinkId: snapshot.id,
            checkoutUrl: `https://pay.payos.vn/web/${snapshot.id}`,
          }
        : {
            kind: 'indeterminate',
            message: 'Provider reported a duplicate order that is not queryable yet',
          };
    }
    if (outcome.kind === 'created') {
      await this.markAttemptCreated(attemptId, outcome.paymentLinkId, outcome.checkoutUrl, now);
      return { status: 201, order: await this.getOrderByPublicId(userId, publicId) };
    }
    await PaymentAttempt.updateOne(
      { _id: attemptId },
      {
        $set: {
          collectionStatus: outcome.kind === 'definite_failure' ? 'failed' : 'creating',
          activeForCheckout: outcome.kind !== 'definite_failure',
          createOutcome: outcome.kind === 'definite_failure' ? 'definite_failure' : 'indeterminate',
          lastProviderError:
            outcome.kind === 'duplicate' ? 'Provider order already exists' : outcome.message,
          nextReconcileAt: new Date(now.getTime() + 60_000),
          ...(outcome.kind === 'definite_failure' ? { terminalConfirmedAt: new Date() } : {}),
        },
        $inc: { version: 1 },
      },
    );
    return {
      status: outcome.kind === 'definite_failure' ? 422 : 202,
      order: await this.getOrderByPublicId(userId, publicId),
    };
  }

  private async getOrderById(userId: string, id: string): Promise<BillingOrderView> {
    const order = await BillingOrder.findOne({
      _id: new Types.ObjectId(id),
      user: objectId(userId),
    })
      .lean<OrderLean>()
      .exec();
    if (!order) throw new BillingDomainError('order_not_found', 'Order not found', 404);
    return this.toOrderView(order);
  }

  private async toOrderView(order: OrderLean): Promise<BillingOrderView> {
    const latestAttempt = await PaymentAttempt.findOne({ order: order._id })
      .sort({ createdAt: -1 })
      .lean<AttemptLean>()
      .exec();
    const activeAttempt = latestAttempt?.activeForCheckout ? latestAttempt : null;
    return {
      id: order.publicId,
      plan: { id: order.planId, name: order.planName },
      currency: order.currency,
      baseAmount: order.baseAmount,
      discountAmount: order.discountAmount,
      finalAmount: order.finalAmount,
      receivedAmount: order.receivedAmount,
      excessAmount: order.excessAmount,
      excessResolution: order.excessResolution,
      collectionStatus: order.collectionStatus,
      ...(latestAttempt ? { attemptCollectionStatus: latestAttempt.collectionStatus } : {}),
      fulfillmentStatus: order.fulfillmentStatus,
      settlementStatus: order.settlementStatus,
      ...(activeAttempt?.checkoutUrl ? { checkoutUrl: activeAttempt.checkoutUrl } : {}),
      ...(activeAttempt ? { activeAttemptId: activeAttempt._id.toString() } : {}),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  async persistVerifiedPayOSWebhook(
    input: VerifiedPayOSWebhookInput,
  ): Promise<PersistedWebhookResult> {
    await connectDB();
    const namespace = {
      provider: 'payos',
      providerAccountId: billingConfig.providerAccountId(),
      environment: billingConfig.providerEnvironment(),
    };
    const payerSignal = this.hashPayerSignal({
      bankId: input.counterAccountBankId,
      accountNumber: input.counterAccountNumber,
    });
    try {
      const created = await PaymentWebhookInbox.create({
        ...namespace,
        dedupKey: `payment:${input.reference}`,
        orderCode: input.orderCode,
        paymentLinkId: input.paymentLinkId,
        transactionReference: input.reference,
        normalizedPayload: {
          orderCode: input.orderCode,
          amount: input.amount,
          currency: input.currency,
          paymentLinkId: input.paymentLinkId,
          reference: input.reference,
          transactionDateTime: input.transactionDateTime,
          payerSignal: payerSignal?.hash ?? null,
          payerSignalKeyVersion: payerSignal?.keyVersion ?? null,
          payerSignalNormalizedVersion: payerSignal?.normalizedVersion ?? null,
        },
        rawPayloadHash: input.rawPayloadHash,
        status: 'verified',
      });
      return { duplicate: false, inboxId: String(created._id) };
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const existing = await PaymentWebhookInbox.findOne({
        ...namespace,
        dedupKey: `payment:${input.reference}`,
      })
        .select({ _id: 1, rawPayloadHash: 1, orderCode: 1, paymentLinkId: 1, normalizedPayload: 1 })
        .lean<ExistingWebhookRecord>()
        .exec();
      if (!existing) throw error;
      const matches =
        existing.rawPayloadHash === input.rawPayloadHash &&
        existing.orderCode === input.orderCode &&
        existing.paymentLinkId === input.paymentLinkId &&
        existing.normalizedPayload?.amount === input.amount &&
        existing.normalizedPayload?.currency === input.currency;
      if (!matches) {
        await PaymentWebhookInbox.updateOne(
          { _id: existing._id },
          {
            $set: {
              status: 'permanent_failure',
              lastError: 'Duplicate payment reference with mismatched payload',
            },
          },
        );
      }
      return { duplicate: true, inboxId: existing._id.toString() };
    }
  }

  async persistUnsupportedPayOSWebhook(rawPayloadHash: string): Promise<PersistedWebhookResult> {
    await connectDB();
    const namespace = {
      provider: 'payos',
      providerAccountId: billingConfig.providerAccountId(),
      environment: billingConfig.providerEnvironment(),
    };
    const dedupKey = `unsupported:${rawPayloadHash}`;
    try {
      const created = await PaymentWebhookInbox.create({
        ...namespace,
        dedupKey,
        rawPayloadHash,
        status: 'permanent_failure',
        lastError: 'Verified webhook schema is unsupported',
      });
      return { duplicate: false, inboxId: String(created._id) };
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const existing = await PaymentWebhookInbox.findOne({ ...namespace, dedupKey })
        .select({ _id: 1 })
        .lean<{ _id: Types.ObjectId }>()
        .exec();
      if (!existing) throw error;
      return { duplicate: true, inboxId: existing._id.toString() };
    }
  }

  private hashPayerSignal(input: PayerSignalInput): PayerSignalHash | null {
    const secret = process.env['ABUSE_SIGNAL_HASH_SECRET'];
    const keyVersion = process.env['ABUSE_SIGNAL_HASH_KEY_VERSION'] ?? 'v1';
    const bank = input.bankId?.trim();
    const account = input.accountNumber?.replace(/[\s-]/g, '');
    if (!secret || secret.length < 32 || !bank || !account || !/^\d{4,30}$/.test(account)) {
      return null;
    }
    return {
      hash: crypto.createHmac('sha256', secret).update(`${bank}:${account}`).digest('hex'),
      keyVersion,
      normalizedVersion: 1,
    };
  }

  async processInbox(limit = 25): Promise<InboxProcessingResult> {
    await connectDB();
    let claimed = 0;
    let processed = 0;
    for (let index = 0; index < limit; index += 1) {
      const now = new Date();
      const event = await PaymentWebhookInbox.findOneAndUpdate(
        {
          status: { $in: ['verified', 'processing', 'retryable_failure', 'orphaned'] },
          nextAttemptAt: { $lte: now },
          $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lt: now } }],
        },
        {
          $set: { status: 'processing', leaseUntil: new Date(now.getTime() + 60_000) },
          $inc: { attemptCount: 1 },
        },
        { new: true, sort: { nextAttemptAt: 1 } },
      )
        .lean<{
          _id: Types.ObjectId;
          orderCode?: number;
          attemptCount: number;
          createdAt: Date;
        }>()
        .exec();
      if (!event) break;
      claimed += 1;
      try {
        if (!event.orderCode) throw new Error('Webhook has no order code');
        const attempt = await PaymentAttempt.findOne({
          provider: 'payos',
          providerAccountId: billingConfig.providerAccountId(),
          environment: billingConfig.providerEnvironment(),
          externalOrderId: event.orderCode.toString(),
        })
          .lean<AttemptLean>()
          .exec();
        if (!attempt) {
          await this.rescheduleInbox(event._id, event.attemptCount, event.createdAt, 'orphaned');
          continue;
        }
        await this.reconcileAttempt(attempt);
        await PaymentWebhookInbox.updateOne(
          { _id: event._id, status: 'processing' },
          { $set: { status: 'processed', processedAt: new Date() }, $unset: { leaseUntil: 1 } },
        );
        processed += 1;
      } catch (error) {
        await this.rescheduleInbox(
          event._id,
          event.attemptCount,
          event.createdAt,
          'retryable_failure',
          error instanceof Error ? error.message : 'Inbox processing failed',
        );
      }
    }
    if (billingConfig.entitlementAutoActivationEnabled()) {
      const fulfillmentBacklog = await BillingOrder.find({
        collectionStatus: { $in: ['paid', 'overpaid'] },
        fulfillmentStatus: { $in: ['unfulfilled', 'processing'] },
      })
        .sort({ updatedAt: 1 })
        .limit(limit)
        .select({ _id: 1 })
        .lean<Array<{ _id: Types.ObjectId }>>()
        .exec();
      for (const order of fulfillmentBacklog) {
        await this.fulfillOrder(order._id);
      }
    }
    return { claimed, processed };
  }

  private async rescheduleInbox(
    id: Types.ObjectId,
    attemptCount: number,
    createdAt: Date,
    status: 'orphaned' | 'retryable_failure',
    error?: string,
  ): Promise<void> {
    const age = Date.now() - createdAt.getTime();
    const deadLetter = attemptCount >= 50 || age >= 7 * 86_400_000;
    await PaymentWebhookInbox.updateOne(
      { _id: id, status: 'processing' },
      {
        $set: {
          status: deadLetter ? 'dead_letter' : status,
          nextAttemptAt: new Date(Date.now() + withJitter(reconciliationDelayMs(age))),
          ...(error ? { lastError: error.slice(0, 1_000) } : {}),
        },
        $unset: { leaseUntil: 1 },
      },
    );
  }

  async reconcileDueAttempts(limit = 25): Promise<ReconciliationResult> {
    await connectDB();
    const attempts = await PaymentAttempt.find({
      collectionStatus: { $in: ['creating', 'pending', 'partial', 'review'] },
      nextReconcileAt: { $lte: new Date() },
    })
      .sort({ nextReconcileAt: 1 })
      .limit(limit)
      .lean<AttemptLean[]>()
      .exec();
    for (const attempt of attempts) await this.reconcileAttempt(attempt);
    const released = await this.releaseDuePromotionReservations(limit);
    return { processed: attempts.length + released };
  }

  private releaseRetryDelay(reservedAt: Date, now = Date.now()): number {
    return withJitter(reconciliationDelayMs(now - reservedAt.getTime()));
  }

  private async reschedulePromotionRelease(
    redemptionId: Types.ObjectId,
    reservedAt: Date,
    error?: unknown,
  ): Promise<void> {
    const delay = this.releaseRetryDelay(reservedAt);
    await PromotionRedemption.updateOne(
      { _id: redemptionId, status: 'reserved' },
      {
        $set: {
          nextReleaseCheckAt: new Date(Date.now() + delay),
          ...(error
            ? {
                lastReleaseError: (error instanceof Error ? error.message : 'Release failed').slice(
                  0,
                  1_000,
                ),
              }
            : {}),
        },
        $inc: { releaseAttemptCount: 1 },
        ...(!error ? { $unset: { lastReleaseError: 1 } } : {}),
      },
    );
  }

  private async releaseDuePromotionReservations(limit: number): Promise<number> {
    const now = new Date();
    const redemptions = await PromotionRedemption.find({
      status: 'reserved',
      $or: [{ nextReleaseCheckAt: { $lte: now } }, { nextReleaseCheckAt: { $exists: false } }],
    })
      .sort({ nextReleaseCheckAt: 1, reservedAt: 1 })
      .limit(limit)
      .select({ order: 1, reservedAt: 1, releaseAttemptCount: 1 })
      .lean<
        Array<{
          _id: Types.ObjectId;
          order: Types.ObjectId;
          reservedAt: Date;
          releaseAttemptCount?: number;
        }>
      >()
      .exec();
    let released = 0;
    for (const redemption of redemptions) {
      try {
        if (
          await this.releasePromotionReservation(
            redemption.order,
            'terminal_zero_payment_reconciliation',
          )
        ) {
          released += 1;
          continue;
        }
        await this.reschedulePromotionRelease(redemption._id, redemption.reservedAt);
      } catch (error) {
        await this.reschedulePromotionRelease(redemption._id, redemption.reservedAt, error);
      }
    }
    return released;
  }

  private async reconcileAttempt(attempt: AttemptLean): Promise<void> {
    const orderCode = Number(attempt.externalOrderId);
    if (!Number.isSafeInteger(orderCode)) throw new Error('Attempt external order ID is invalid');
    const snapshot = await this.payos.getPayment(orderCode);
    if (!snapshot) {
      const age = Date.now() - attempt.createdAt.getTime();
      await PaymentAttempt.updateOne(
        { _id: attempt._id },
        {
          $set: {
            nextReconcileAt: new Date(Date.now() + withJitter(reconciliationDelayMs(age))),
            ...(age >= 24 * 60 * 60_000 ? { collectionStatus: 'review' } : {}),
          },
          $inc: { reconcileCount: 1, version: 1 },
        },
      );
      return;
    }
    if (
      snapshot.orderCode !== orderCode ||
      snapshot.amount !== attempt.requestedAmount ||
      (attempt.paymentLinkId !== undefined && snapshot.id !== attempt.paymentLinkId) ||
      (snapshot.currency !== undefined && snapshot.currency !== attempt.currency) ||
      snapshot.amountPaid < 0 ||
      snapshot.amountRemaining < 0
    ) {
      await PaymentAttempt.updateOne(
        { _id: attempt._id },
        { $set: { collectionStatus: 'review', lastProviderError: 'Provider invariant mismatch' } },
      );
      await BillingOrder.updateOne(
        { _id: attempt.order },
        { $set: { collectionStatus: 'review' } },
      );
      return;
    }

    for (const transaction of snapshot.transactions) {
      const providerEventAt = new Date(transaction.transactionDateTime);
      const transactionKey = {
        provider: 'payos' as const,
        providerAccountId: attempt.providerAccountId,
        environment: attempt.environment,
        transactionType: 'payment' as const,
        externalReference: transaction.reference,
      };
      const persistedTransaction = await PaymentTransaction.findOneAndUpdate(
        transactionKey,
        {
          $setOnInsert: {
            ...transactionKey,
            attempt: attempt._id,
            order: attempt.order,
            currency: attempt.currency,
            signedAmount: transaction.amount,
            direction: 'incoming',
            providerEventAt: Number.isNaN(providerEventAt.getTime()) ? new Date() : providerEventAt,
            settlementState: 'confirmed',
            rawPayloadHash: crypto
              .createHash('sha256')
              .update(JSON.stringify(transaction))
              .digest('hex'),
          },
        },
        { upsert: true, new: true },
      )
        .lean<{
          attempt: Types.ObjectId;
          order: Types.ObjectId;
          currency: string;
          signedAmount: number;
        }>()
        .exec();
      if (
        !persistedTransaction.attempt.equals(attempt._id) ||
        !persistedTransaction.order.equals(attempt.order) ||
        persistedTransaction.currency !== attempt.currency ||
        persistedTransaction.signedAmount !== transaction.amount
      ) {
        await PaymentAttempt.updateOne(
          { _id: attempt._id },
          {
            $set: {
              collectionStatus: 'review',
              lastProviderError: 'Provider transaction identity collision',
            },
          },
        );
        await BillingOrder.updateOne(
          { _id: attempt.order },
          { $set: { collectionStatus: 'review' } },
        );
        return;
      }
    }

    const nextStatus = payosStatus(snapshot);
    if (!canApplyCollectionTransition(attempt.collectionStatus, nextStatus)) return;
    const terminal = ['paid', 'cancelled', 'expired', 'failed'].includes(nextStatus);
    const transitioned = await PaymentAttempt.updateOne(
      {
        _id: attempt._id,
        version: attempt.version,
        collectionStatus: attempt.collectionStatus,
      },
      {
        $set: {
          paymentLinkId: snapshot.id,
          amountPaid: snapshot.amountPaid,
          amountRemaining: snapshot.amountRemaining,
          collectionStatus: nextStatus,
          activeForCheckout: !terminal,
          ...(terminal ? { terminalConfirmedAt: new Date() } : {}),
          nextReconcileAt: new Date(
            Date.now() +
              withJitter(reconciliationDelayMs(Date.now() - attempt.createdAt.getTime())),
          ),
        },
        $inc: { reconcileCount: 1, version: 1 },
      },
    );
    if (transitioned.matchedCount !== 1) return;
    await this.refreshOrderCollection(attempt.order, attempt._id, snapshot);
    await IdempotencyRecord.updateMany(
      { order: attempt.order, status: 'processing' },
      {
        $set: {
          status: 'completed',
          responseStatus: 201,
          responseBodySnapshot: { orderId: attempt.order.toString() },
        },
      },
    );
    if (snapshot.amountPaid === 0 && ['cancelled', 'expired', 'failed'].includes(nextStatus)) {
      await PromotionRedemption.updateOne(
        { order: attempt.order, status: 'reserved' },
        { $set: { nextReleaseCheckAt: new Date() } },
      );
      await this.releasePromotionReservation(attempt.order, `provider_${nextStatus}`);
    }
  }

  private async releasePromotionReservation(
    orderId: Types.ObjectId,
    reason: string,
  ): Promise<boolean> {
    const firstPurchaseClaim = await FirstPurchaseClaim.findOne({ order: orderId })
      .select({ user: 1 })
      .lean<{ user: Types.ObjectId }>()
      .exec();
    if (firstPurchaseClaim) {
      await this.ensureFirstPurchaseEligibility(firstPurchaseClaim.user);
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
            {
              collectionStatus: {
                $in: ['creating', 'pending', 'partial', 'paid', 'review'],
              },
            },
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
        const redemption = await PromotionRedemption.findOne({
          order: orderId,
          status: 'reserved',
        })
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
          {
            promotion: redemption.promotion,
            user: redemption.user,
            reservedCount: { $gt: 0 },
          },
          { $inc: { reservedCount: -1 } },
          { session },
        );
        const redemptionResult = await PromotionRedemption.updateOne(
          { _id: redemption._id, status: 'reserved' },
          {
            $set: {
              status: 'released',
              releasedAt: new Date(),
              releaseReason: reason,
            },
          },
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
          {
            $set: {
              status: 'released',
              releasedAt: new Date(),
              releaseReason: reason,
            },
          },
          { session },
        );
        await this.releaseFirstPurchaseEligibility(redemption.user, orderId, session);
        return true;
      });
      return released ?? false;
    } finally {
      await session.endSession();
    }
  }

  private async refreshOrderCollection(
    orderId: Types.ObjectId,
    attemptId: Types.ObjectId,
    snapshot: ProviderPaymentSnapshot,
  ): Promise<void> {
    const attemptAggregates = await PaymentTransaction.aggregate<{
      _id: null;
      received: number;
    }>([
      {
        $match: {
          attempt: attemptId,
          transactionType: 'payment',
          direction: 'incoming',
        },
      },
      { $group: { _id: null, received: { $sum: '$signedAmount' } } },
    ]);
    const attemptLedgerReceived = attemptAggregates[0]?.received ?? 0;
    if (attemptLedgerReceived !== snapshot.amountPaid) {
      await PaymentAttempt.updateOne(
        { _id: attemptId },
        {
          $set: {
            collectionStatus: 'review',
            lastProviderError: 'Provider amountPaid does not match the attempt transaction ledger',
          },
        },
      );
      await BillingOrder.updateOne(
        { _id: orderId },
        {
          $set: {
            collectionStatus: 'review',
          },
          $inc: { version: 1 },
        },
      );
      return;
    }

    const orderAggregates = await PaymentTransaction.aggregate<{
      _id: null;
      received: number;
      earliestPaidAt: Date;
    }>([
      { $match: { order: orderId, transactionType: 'payment', direction: 'incoming' } },
      {
        $group: {
          _id: null,
          received: { $sum: '$signedAmount' },
          earliestPaidAt: { $min: '$providerEventAt' },
        },
      },
    ]);
    const order = await BillingOrder.findById(orderId).lean<OrderLean>().exec();
    if (!order) return;
    const received = orderAggregates[0]?.received ?? 0;
    const collectionStatus =
      received > order.finalAmount
        ? 'overpaid'
        : received === order.finalAmount
          ? 'paid'
          : received > 0
            ? 'partial'
            : 'unpaid';
    await BillingOrder.updateOne(
      { _id: orderId },
      {
        $set: {
          receivedAmount: received,
          excessAmount: Math.max(0, received - order.finalAmount),
          excessResolution: received > order.finalAmount ? 'unallocated' : 'none',
          collectionStatus,
          ...(orderAggregates[0]?.earliestPaidAt
            ? { providerPaidAt: orderAggregates[0].earliestPaidAt }
            : {}),
        },
        $inc: { version: 1 },
      },
    );
    if (collectionStatus === 'paid' || collectionStatus === 'overpaid') {
      await this.fulfillOrder(orderId);
    }
  }

  private async ensureEntitlementAccount(userId: Types.ObjectId): Promise<void> {
    try {
      await EntitlementAccount.updateOne(
        { user: userId },
        {
          $setOnInsert: {
            user: userId,
            version: 0,
            nextSequence: 1,
            perpetual: false,
            lastCheckpointSequence: 0,
          },
        },
        { upsert: true },
      );
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }

  private async fulfillOrder(orderId: Types.ObjectId): Promise<void> {
    if (!billingConfig.entitlementAutoActivationEnabled()) {
      await BillingOrder.updateOne(
        { _id: orderId, fulfillmentStatus: 'unfulfilled' },
        { $set: { fulfillmentStatus: 'processing' } },
      );
      return;
    }
    const order = await BillingOrder.findById(orderId).lean<OrderLean>().exec();
    if (!order || order.fulfillmentStatus === 'fulfilled') return;
    await this.ensureEntitlementAccount(order.user);
    if (order.eligibilityClass === 'first_purchase') {
      await this.ensureFirstPurchaseEligibility(order.user);
    }
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const currentOrder = await BillingOrder.findOneAndUpdate(
          {
            _id: orderId,
            collectionStatus: { $in: ['paid', 'overpaid'] },
            fulfillmentStatus: { $in: ['unfulfilled', 'processing'] },
          },
          { $set: { fulfillmentStatus: 'processing' }, $inc: { version: 1 } },
          { new: true, session },
        )
          .lean<OrderLean>()
          .exec();
        if (!currentOrder) return;
        const existingGrant = await EntitlementGrant.findOne({
          sourceType: 'billing_order',
          sourceId: orderId.toString(),
        })
          .session(session)
          .lean<{ _id: Types.ObjectId }>()
          .exec();
        if (!existingGrant) {
          const account = await EntitlementAccount.findOneAndUpdate(
            { user: currentOrder.user },
            { $inc: { version: 1, nextSequence: 1 } },
            { new: true, session },
          )
            .lean<{
              nextSequence: number;
              currentEndAt?: Date;
              perpetual: boolean;
            }>()
            .exec();
          if (!account) throw new Error('Entitlement account disappeared');
          if (account.perpetual) {
            await BillingOrder.updateOne(
              { _id: orderId },
              { $set: { fulfillmentStatus: 'review' } },
              { session },
            );
            return;
          }
          const committedAt = new Date();
          const active =
            account.currentEndAt && account.currentEndAt.getTime() > committedAt.getTime();
          const lastGrant = active
            ? await EntitlementGrant.findOne({ user: currentOrder.user })
                .sort({ sequence: -1 })
                .session(session)
                .lean<{
                  segmentId: string;
                  segmentBaselineStartAt: Date;
                  segmentAnchorDay: number;
                }>()
                .exec()
            : null;
          const baseline = active && account.currentEndAt ? account.currentEndAt : committedAt;
          const segmentId = lastGrant?.segmentId ?? crypto.randomUUID();
          const segmentBaseline = lastGrant?.segmentBaselineStartAt ?? baseline;
          const anchorDay = lastGrant?.segmentAnchorDay ?? baseline.getUTCDate();
          const projectionEnd =
            currentOrder.durationUnit === 'month'
              ? addCalendarMonths(baseline, currentOrder.durationValue, anchorDay)
              : new Date(baseline.getTime() + currentOrder.durationValue * 86_400_000);
          await EntitlementGrant.create(
            [
              {
                user: currentOrder.user,
                sourceType: 'billing_order',
                sourceId: orderId.toString(),
                sequence: account.nextSequence - 1,
                segmentId,
                planId: currentOrder.planId,
                planName: currentOrder.planName,
                durationUnit: currentOrder.durationUnit,
                durationValue: currentOrder.durationValue,
                segmentBaselineStartAt: segmentBaseline,
                segmentAnchorDay: anchorDay,
                committedAt,
                providerPaidAt: currentOrder.providerPaidAt,
                originalEffectiveStartAt: baseline,
                originalEffectiveEndAt: projectionEnd,
              },
            ],
            { session },
          );
        }

        const grants = await EntitlementGrant.find({ user: currentOrder.user })
          .sort({ sequence: 1 })
          .session(session)
          .lean<
            Array<{
              _id: Types.ObjectId;
              sequence: number;
              segmentId: string;
              segmentBaselineStartAt: Date;
              segmentAnchorDay: number;
              durationUnit: 'day' | 'month' | 'perpetual';
              durationValue?: number;
            }>
          >()
          .exec();
        const adjustments = await EntitlementAdjustment.find({ user: currentOrder.user })
          .sort({ sequence: 1 })
          .session(session)
          .lean<
            Array<{
              sequence: number;
              grant: Types.ObjectId;
              type: 'revoke' | 'restore';
            }>
          >()
          .exec();
        if (grants.length > 500) {
          await BillingOrder.updateOne(
            { _id: orderId },
            { $set: { fulfillmentStatus: 'review' } },
            { session },
          );
          return;
        }
        const projection = replayEntitlement(
          grants.map((grant) => ({
            id: grant._id.toString(),
            sequence: grant.sequence,
            segmentId: grant.segmentId,
            segmentBaselineStartAt: grant.segmentBaselineStartAt,
            segmentAnchorDay: grant.segmentAnchorDay,
            durationUnit: grant.durationUnit,
            ...(grant.durationValue !== undefined ? { durationValue: grant.durationValue } : {}),
          })),
          adjustments.map((adjustment) => ({
            sequence: adjustment.sequence,
            grantId: adjustment.grant.toString(),
            type: adjustment.type,
          })),
        );
        if (!projection.startAt) throw new Error('Entitlement projection is empty');
        const checksum = crypto
          .createHash('sha256')
          .update(
            JSON.stringify({
              startAt: projection.startAt.toISOString(),
              endAt: projection.endAt?.toISOString() ?? null,
              perpetual: projection.perpetual,
            }),
          )
          .digest('hex');
        await EntitlementAccount.updateOne(
          { user: currentOrder.user },
          {
            $set: {
              planId: currentOrder.planId,
              planName: currentOrder.planName,
              currentStartAt: projection.startAt,
              currentEndAt: projection.endAt,
              perpetual: projection.perpetual,
              projectionChecksum: checksum,
            },
          },
          { session },
        );
        await User.updateOne(
          { _id: currentOrder.user, disable: 0 },
          {
            $set: {
              subscription: {
                planId: currentOrder.planId,
                planName: currentOrder.planName,
                startDate: projection.startAt,
                ...(projection.endAt ? { endDate: projection.endAt } : {}),
                isActive: true,
                payosOrderId: currentOrder.orderCode.toString(),
              },
            },
          },
          { session },
        );
        await this.consumePromotion(currentOrder, session);
        await BillingOrder.updateOne(
          { _id: orderId, fulfillmentStatus: 'processing' },
          { $set: { fulfillmentStatus: 'fulfilled', fulfilledAt: new Date() } },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
  }

  private async consumePromotion(order: OrderLean, session: ClientSession): Promise<void> {
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
      {
        $set: {
          status: late ? 'late_redeemed' : 'redeemed',
          redeemedAt: new Date(),
        },
      },
      { session },
    );
    await Promotion.updateOne(
      { _id: order.promotionId },
      {
        $inc: {
          ...(late ? { overrunCount: 1 } : { reservedCount: -1 }),
          redeemedCount: 1,
        },
      },
      { session },
    );
    await PromotionUserCounter.updateOne(
      { promotion: order.promotionId, user: order.user },
      {
        $inc: {
          ...(late ? {} : { reservedCount: -1 }),
          redeemedCount: 1,
        },
      },
      { session },
    );
    if (order.eligibilityClass === 'first_purchase') {
      const claim = await FirstPurchaseClaim.findOne({ order: order._id })
        .session(session)
        .lean<{
          _id: Types.ObjectId;
          status: 'reserved' | 'consumed' | 'released' | 'late_consumed';
        }>()
        .exec();
      if (claim) {
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
            {
              $set: {
                status: 'consumed',
                consumedAt: new Date(),
              },
              $inc: { version: 1 },
            },
            { session },
          );
        } else if (claim.status === 'released') {
          await FirstPurchaseEligibility.updateOne(
            {
              user: order.user,
              eligibilityClass: 'first_purchase',
              status: { $in: ['available', 'reserved'] },
            },
            {
              $set: {
                status: 'consumed',
                activeOrder: order._id,
                consumedAt: new Date(),
              },
              $unset: {
                releasedAt: 1,
                reservedAt: 1,
              },
              $inc: { version: 1 },
            },
            { session },
          );
        }
      }
    }
  }

  private promotionAdminView(promotion: PromotionLean): PromotionAdminView {
    return {
      id: promotion._id.toString(),
      code: promotion.code,
      ...(promotion.description !== undefined ? { description: promotion.description } : {}),
      kind: promotion.kind,
      ...(promotion.percentageOff !== undefined ? { percentageOff: promotion.percentageOff } : {}),
      ...(promotion.percentageCap !== undefined ? { percentageCap: promotion.percentageCap } : {}),
      ...(promotion.fixedAmount !== undefined ? { fixedAmount: promotion.fixedAmount } : {}),
      minimumSubtotal: promotion.minimumSubtotal,
      eligibilityClass: promotion.eligibilityClass,
      ...(promotion.totalLimit !== undefined ? { totalLimit: promotion.totalLimit } : {}),
      perUserLimit: promotion.perUserLimit,
      reservedCount: promotion.reservedCount,
      redeemedCount: promotion.redeemedCount,
      overrunCount: promotion.overrunCount,
      startsAt: promotion.startsAt.toISOString(),
      endsAt: promotion.endsAt.toISOString(),
      active: promotion.active,
      version: promotion.version,
    };
  }

  async listPromotions(): Promise<PromotionAdminView[]> {
    await connectDB();
    const promotions = await Promotion.find()
      .sort({ createdAt: -1 })
      .lean<PromotionLean[]>()
      .exec();
    return promotions.map((promotion) => this.promotionAdminView(promotion));
  }

  async createPromotion(input: CreatePromotionInput): Promise<PromotionAdminView> {
    await connectDB();
    const normalizedCode = normalizePromoCode(input.code);
    try {
      const created = await Promotion.create({
        code: normalizedCode,
        normalizedCode,
        ...(input.description !== undefined ? { description: input.description } : {}),
        kind: input.kind,
        ...(input.percentageOff !== undefined ? { percentageOff: input.percentageOff } : {}),
        ...(input.percentageCap !== undefined ? { percentageCap: input.percentageCap } : {}),
        ...(input.fixedAmount !== undefined ? { fixedAmount: input.fixedAmount } : {}),
        currency: input.currency ?? 'VND',
        minimumSubtotal: input.minimumSubtotal,
        eligibilityClass: input.eligibilityClass,
        ...(input.totalLimit !== undefined ? { totalLimit: input.totalLimit } : {}),
        perUserLimit: input.perUserLimit,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
      });
      return this.promotionAdminView(created.toObject<PromotionLean>());
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new BillingDomainError('promotion_conflict', 'Promotion code is already used', 409);
      }
      throw error;
    }
  }

  async archivePromotion(id: string): Promise<PromotionAdminView> {
    await connectDB();
    if (!Types.ObjectId.isValid(id)) {
      throw new BillingDomainError('promotion_not_found', 'Promotion not found', 404);
    }
    const promotion = await Promotion.findOneAndUpdate(
      { _id: id, archivedAt: { $exists: false } },
      {
        $set: { active: false, archivedAt: new Date() },
        $inc: { version: 1 },
      },
      { new: true, runValidators: true },
    )
      .lean<PromotionLean>()
      .exec();
    if (!promotion) {
      throw new BillingDomainError('promotion_not_found', 'Promotion not found', 404);
    }
    return this.promotionAdminView(promotion);
  }

  async recordExternalMoneyAdjustment(
    input: CreateExternalMoneyAdjustmentInput,
  ): Promise<BillingOrderView> {
    await connectDB();
    const orderId = objectId(input.orderId);
    const recordedBy = objectId(input.recordedBy);
    const occurredAt = new Date(input.occurredAt);
    if (
      !Number.isSafeInteger(input.amount) ||
      input.amount <= 0 ||
      Number.isNaN(occurredAt.getTime())
    ) {
      throw new BillingDomainError('validation_error', 'Invalid money adjustment', 400);
    }
    const namespace = {
      provider: 'payos',
      providerAccountId: billingConfig.providerAccountId(),
      environment: billingConfig.providerEnvironment(),
      type: input.type,
      externalReference: input.externalReference.trim(),
    };
    const existing = await ExternalMoneyAdjustment.findOne(namespace)
      .lean<{ order: Types.ObjectId }>()
      .exec();
    if (existing) {
      const current = await BillingOrder.findById(orderId).lean<OrderLean>().exec();
      if (!current) throw new BillingDomainError('order_not_found', 'Order not found', 404);
      return this.toOrderView(current);
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const order = await BillingOrder.findById(orderId)
          .session(session)
          .lean<{
            currency: 'VND';
            receivedAmount: number;
            settlementStatus: string;
          }>()
          .exec();
        if (!order) throw new BillingDomainError('order_not_found', 'Order not found', 404);
        if (order.currency !== input.currency) {
          throw new BillingDomainError('currency_mismatch', 'Currency does not match order', 400);
        }
        const paymentTransaction = await PaymentTransaction.findOne({
          order: orderId,
          transactionType: 'payment',
          direction: 'incoming',
        })
          .sort({ providerEventAt: 1 })
          .session(session)
          .lean<{ _id: Types.ObjectId }>()
          .exec();
        if (!paymentTransaction) {
          throw new BillingDomainError('payment_not_found', 'No captured payment was found', 409);
        }
        if (input.allocation === 'principal' && input.amount > order.receivedAmount) {
          throw new BillingDomainError(
            'adjustment_exceeds_payment',
            'Adjustment exceeds captured amount',
            409,
          );
        }
        await ExternalMoneyAdjustment.create(
          [
            {
              order: orderId,
              paymentTransaction: paymentTransaction._id,
              ...namespace,
              amount: input.amount,
              currency: input.currency,
              allocation: input.allocation,
              occurredAt,
              recordedBy,
            },
          ],
          { session },
        );
        const settlementStatus =
          input.type === 'chargeback'
            ? 'charged_back'
            : input.type === 'chargeback_reversal'
              ? 'reversed'
              : input.type === 'refund'
                ? 'partially_refunded'
                : order.settlementStatus;
        await BillingOrder.updateOne(
          { _id: orderId },
          {
            $set: {
              settlementStatus,
              ...(input.type === 'chargeback' || input.type === 'refund'
                ? { fulfillmentStatus: 'review' }
                : {}),
            },
          },
          { session },
        );
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        const current = await BillingOrder.findById(orderId).lean<OrderLean>().exec();
        if (!current) throw new BillingDomainError('order_not_found', 'Order not found', 404);
        return this.toOrderView(current);
      }
      throw error;
    } finally {
      await session.endSession();
    }
    return this.getOrderByPublicId(input.recordedBy, input.orderId);
  }

  async consumeInternalNonce(nonce: string, expiresAt: Date): Promise<void> {
    await connectDB();
    try {
      await InternalRequestNonce.create({ nonce, expiresAt });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new BillingDomainError('unauthorized', 'Internal request was replayed', 401);
      }
      throw error;
    }
  }
}
