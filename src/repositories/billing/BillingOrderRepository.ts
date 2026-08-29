import crypto from 'crypto';
import mongoose, { Types, type ClientSession } from 'mongoose';
import connectDB from '@/lib/mongoose';
import Plan from '@/models/Plan';
import User from '@/models/User';
import {
  BillingCounter,
  BillingOrder,
  EntitlementAccount,
  EntitlementGrant,
  FirstPurchaseClaim,
  FirstPurchaseEligibility,
  IdempotencyRecord,
  PaymentAttempt,
  PaymentTransaction,
  Promotion,
  PromotionUserCounter,
} from '@/models/Billing';
import type {
  BillingOrderMutationResult,
  BillingOrderView,
  BillingQuoteResult,
  CreateBillingOrderInput,
  IBillingOrderRepository,
} from '@/interfaces/repositories/IBillingOrderRepository';
import {
  BillingDomainError,
  calculateDiscount,
  hashIdempotencyRequest,
  normalizePromoCode,
} from '@/services/billing/billing-domain';
import { billingConfig } from '@/services/billing/billing-config';
import {
  issueQuoteToken,
  verifyQuoteToken,
  type BillingQuotePayload,
} from '@/services/billing/quote-token';
import {
  BillingPayOSAdapter,
  type BillingPaymentProvider,
  type ProviderCreateOutcome,
} from '@/services/billing/payos-adapter';
import type {
  BillingOrderPersistenceRecord,
  BillingPlanPersistenceRecord,
  IdempotencyPersistenceRecord,
  PaymentAttemptPersistenceRecord,
  PromotionPersistenceRecord,
} from '@/repositories/types/BillingPersistence';
import { objectId, parsePlanDuration, requireCreatedObjectId, toOrderView } from './billing-shared';
import {
  ensureFirstPurchaseEligibility,
  releaseReservationForFailedCreate,
  reservePromotion,
} from './promotion-lifecycle';

/**
 * Checkout persistence: pricing an order, opening it, and opening a fresh
 * attempt when the last one died without money.
 *
 * The order and its first attempt are created in one transaction and the
 * provider is called afterwards, never inside it. A provider call inside a
 * transaction would hold the commit open for a network round trip and, worse,
 * could succeed while the transaction aborts — leaving a live payment link for
 * an order that does not exist.
 */

interface ComputedQuote {
  payload: BillingQuotePayload;
  plan: BillingPlanPersistenceRecord;
  promotion: PromotionPersistenceRecord | null;
}

interface CreateProviderCheckoutInput {
  orderCode: number;
  amount: number;
  description: string;
  publicId: string;
  baseUrl: string;
  buyerEmail: string;
  now: Date;
}

const CHECKOUT_WINDOW_MS = 15 * 60_000;
const FIRST_RECONCILE_DELAY_MS = 60_000;
const ORDER_ENDPOINT = '/api/billing/orders';

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

export class BillingOrderRepository implements IBillingOrderRepository {
  constructor(private readonly payos: BillingPaymentProvider = new BillingPayOSAdapter()) {}

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

  /**
   * The order, or a 404 — scoped to its owner in the same query. Splitting the
   * ownership filter from the not-found check is how one caller ends up able to
   * read another customer's order and report it as merely missing.
   */
  private async loadOwnedOrder(
    userId: string,
    publicId: string,
  ): Promise<BillingOrderPersistenceRecord> {
    const order = await BillingOrder.findOne({ publicId, user: objectId(userId) })
      .lean<BillingOrderPersistenceRecord>()
      .exec();
    if (!order) throw new BillingDomainError('order_not_found', 'Order not found', 404);
    return order;
  }

  async getOrderByPublicId(userId: string, publicId: string): Promise<BillingOrderView> {
    await connectDB();
    return toOrderView(await this.loadOwnedOrder(userId, publicId));
  }

  async createOrder(input: CreateBillingOrderInput): Promise<BillingOrderMutationResult> {
    if (!/^[A-Za-z0-9._:-]{16,200}$/.test(input.idempotencyKey)) {
      throw new BillingDomainError('invalid_idempotency_key', 'Idempotency key is invalid', 400);
    }
    await connectDB();
    const user = objectId(input.userId);
    const requestHash = hashIdempotencyRequest({
      endpoint: ORDER_ENDPOINT,
      apiVersion: 'v1',
      payload: { quoteToken: input.quoteToken },
    });
    const existing = await IdempotencyRecord.findOne({
      user,
      endpoint: ORDER_ENDPOINT,
      apiVersion: 'v1',
      idempotencyKey: input.idempotencyKey,
    })
      .lean<IdempotencyPersistenceRecord>()
      .exec();
    if (existing) return this.replayIdempotentOrder(input, existing, requestHash);

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
      await ensureFirstPurchaseEligibility(user);
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
              endpoint: ORDER_ENDPOINT,
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
        await reservePromotion({
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
              expiresAt: new Date(now.getTime() + CHECKOUT_WINDOW_MS),
              nextReconcileAt: now,
            },
          ],
          { session },
        );
      });
    } catch (error) {
      const raced = await this.resolveIdempotencyRace(input, requestHash, error);
      if (raced) return raced;
      throw error;
    } finally {
      await session.endSession();
    }
    const createdOrderId = requireCreatedObjectId(orderId);
    const createdAttemptId = requireCreatedObjectId(attemptId);

    const outcome = await this.openCheckout({
      orderCode,
      amount: recomputed.payload.finalAmount,
      description: recomputed.plan.name.slice(0, 25),
      publicId,
      baseUrl,
      buyerEmail,
      now,
    });

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
          nextReconcileAt: new Date(now.getTime() + FIRST_RECONCILE_DELAY_MS),
        },
        $inc: { version: 1 },
      },
    );
    return { status: 202, order: await this.getOrderById(input.userId, createdOrderId.toString()) };
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
    const order = await this.loadOwnedOrder(userId, publicId);
    if (order.collectionStatus !== 'unpaid') {
      throw new BillingDomainError(
        'payment_state_conflict',
        'A replacement attempt requires an unpaid order',
      );
    }
    const previous = await PaymentAttempt.findOne({ order: order._id })
      .sort({ createdAt: -1 })
      .lean<PaymentAttemptPersistenceRecord>()
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
              expiresAt: new Date(now.getTime() + CHECKOUT_WINDOW_MS),
              nextReconcileAt: now,
            },
          ],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    const outcome = await this.openCheckout({
      orderCode,
      amount: order.finalAmount,
      description: order.planName.slice(0, 25),
      publicId: order.publicId,
      baseUrl,
      buyerEmail,
      now,
    });
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
          nextReconcileAt: new Date(now.getTime() + FIRST_RECONCILE_DELAY_MS),
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

  /** The stored answer for an idempotency key we have already seen. */
  private async replayIdempotentOrder(
    input: CreateBillingOrderInput,
    existing: IdempotencyPersistenceRecord,
    requestHash: string,
  ): Promise<BillingOrderMutationResult> {
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

  /**
   * Two requests carrying the same idempotency key can reach the insert at
   * once; the loser sees a duplicate-key error and must answer with the
   * winner's order rather than with a failure the caller cannot act on.
   */
  private async resolveIdempotencyRace(
    input: CreateBillingOrderInput,
    requestHash: string,
    error: unknown,
  ): Promise<BillingOrderMutationResult | null> {
    if ((error as { code?: number }).code !== 11000) return null;
    const raced = await IdempotencyRecord.findOne({
      user: objectId(input.userId),
      endpoint: ORDER_ENDPOINT,
      apiVersion: 'v1',
      idempotencyKey: input.idempotencyKey,
    })
      .lean<IdempotencyPersistenceRecord>()
      .exec();
    if (!raced?.order || raced.requestHash !== requestHash) return null;
    return this.replayIdempotentOrder(input, raced, requestHash);
  }

  private async computeQuote(
    userId: string,
    planId: string,
    promoCode: string | null,
    now = new Date(),
  ): Promise<ComputedQuote> {
    await connectDB();
    const userObjectId = objectId(userId);
    const [plan, entitlement] = await Promise.all([
      Plan.findOne({ _id: planId, isActive: true }).lean<BillingPlanPersistenceRecord>().exec(),
      EntitlementAccount.findOne({ user: userObjectId }).lean<{ perpetual: boolean }>().exec(),
    ]);
    if (!plan) throw new BillingDomainError('plan_not_found', 'Plan is not available', 404);
    if (entitlement?.perpetual === true) {
      throw new BillingDomainError(
        'already_has_perpetual_entitlement',
        'This account already has perpetual Premium',
      );
    }

    let promotion: PromotionPersistenceRecord | null = null;
    let discountAmount = 0;
    let finalAmount = plan.price;
    if (promoCode) {
      promotion = await this.loadApplicablePromotion(userObjectId, promoCode, now);
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

  /**
   * Every reason a promo code can be unusable answers with the same message, so
   * the endpoint cannot be used to enumerate which codes exist, which are
   * exhausted, or whether this account has bought before.
   */
  private async loadApplicablePromotion(
    user: Types.ObjectId,
    promoCode: string,
    now: Date,
  ): Promise<PromotionPersistenceRecord> {
    const normalizedCode = normalizePromoCode(promoCode);
    const promotion = await Promotion.findOne({ normalizedCode })
      .lean<PromotionPersistenceRecord>()
      .exec();
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

    const userCounter = await PromotionUserCounter.findOne({ promotion: promotion._id, user })
      .lean<{ reservedCount: number; redeemedCount: number }>()
      .exec();
    if (
      (userCounter?.reservedCount ?? 0) + (userCounter?.redeemedCount ?? 0) >=
      promotion.perUserLimit
    ) {
      throw new BillingDomainError('promo_not_applicable', 'Promo code is not applicable');
    }
    if (promotion.eligibilityClass !== 'first_purchase') return promotion;

    const [paidOrder, claim, eligibility, entitlementGrant] = await Promise.all([
      BillingOrder.exists({ user, receivedAmount: { $gt: 0 } }),
      FirstPurchaseClaim.exists({
        user,
        eligibilityClass: 'first_purchase',
        status: { $in: ['reserved', 'consumed', 'late_consumed'] },
      }),
      FirstPurchaseEligibility.exists({
        user,
        eligibilityClass: 'first_purchase',
        status: { $in: ['reserved', 'consumed'] },
      }),
      EntitlementGrant.exists({ user }),
    ]);
    if (paidOrder || claim || eligibility || entitlementGrant) {
      throw new BillingDomainError('promo_not_applicable', 'Promo code is not applicable');
    }
    return promotion;
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

  private async userEmail(userId: Types.ObjectId): Promise<string> {
    const user = await User.findById(userId).select({ email: 1 }).lean<{ email: string }>().exec();
    if (!user) throw new BillingDomainError('user_not_found', 'User not found', 404);
    return user.email;
  }

  /**
   * Opens the checkout and resolves the provider's one ambiguous answer. A
   * `duplicate` means the order code already exists there, which after a
   * retried create is usually our own earlier call: querying it back turns the
   * ambiguity into either a usable link or an honest `indeterminate`.
   */
  private async openCheckout(input: CreateProviderCheckoutInput): Promise<ProviderCreateOutcome> {
    const callbackUrl = `${input.baseUrl}/checkout?order=${input.publicId}`;
    const outcome = await this.payos.createCheckout({
      orderCode: input.orderCode,
      amount: input.amount,
      description: input.description,
      returnUrl: callbackUrl,
      cancelUrl: callbackUrl,
      expiredAt: Math.floor((input.now.getTime() + CHECKOUT_WINDOW_MS) / 1_000),
      buyerEmail: input.buyerEmail,
    });
    if (outcome.kind !== 'duplicate') return outcome;
    const snapshot = await this.payos.getPayment(input.orderCode);
    if (!snapshot) {
      return {
        kind: 'indeterminate',
        message: 'Provider reported a duplicate order that is not queryable yet',
      };
    }
    return {
      kind: 'created',
      paymentLinkId: snapshot.id,
      checkoutUrl: `https://pay.payos.vn/web/${snapshot.id}`,
    };
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
          nextReconcileAt: new Date(now.getTime() + FIRST_RECONCILE_DELAY_MS),
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

  /**
   * Records a provider rejection: the attempt is failed, the promo reservation
   * given back, and the idempotency record made deterministic so a retry with
   * the same key returns the same 422 rather than trying again.
   *
   * The order stays `unpaid`, which is what it is: no money was ever collected.
   * Marking it `review` put every ordinary provider rejection into the operator
   * queue, where there is nothing to decide. The attempt carries the diagnosis.
   */
  private async failOrderCreation(
    orderId: Types.ObjectId,
    attemptId: Types.ObjectId,
    message: string,
  ): Promise<void> {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await releaseReservationForFailedCreate(orderId, session);
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

  private async getOrderById(userId: string, id: string): Promise<BillingOrderView> {
    const order = await BillingOrder.findOne({
      _id: new Types.ObjectId(id),
      user: objectId(userId),
    })
      .lean<BillingOrderPersistenceRecord>()
      .exec();
    if (!order) throw new BillingDomainError('order_not_found', 'Order not found', 404);
    return toOrderView(order);
  }
}
