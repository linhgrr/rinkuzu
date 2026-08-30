import crypto from 'crypto';
import { Types } from 'mongoose';
import connectDB from '@/lib/mongoose';
import { BillingOrder, PaymentAttempt } from '@/models/Billing';
import type {
  AcquireAttemptLeaseInput,
  ClaimDueAttemptInput,
  ClaimDueFulfillmentsInput,
  DueFulfillmentOrder,
  FulfillmentWork,
  IBillingSettlementRepository,
  InboxWork,
  OrderRef,
  OwnedOrderAttemptQuery,
  SettlementAttemptSnapshot,
  SettlementWork,
} from '@/interfaces/repositories/IBillingSettlementRepository';
import { BillingDomainError } from '@/services/billing/billing-domain';
import {
  OPEN_ATTEMPT_STATES,
  TERMINAL_ATTEMPT_STATES,
} from '@/services/billing/domain/attempt-transition';
import { billingConfig } from '@/services/billing/billing-config';
import { EntitlementLedgerRepository } from '@/repositories/EntitlementLedgerRepository';
import type {
  BillingOrderPersistenceRecord,
  PaymentAttemptPersistenceRecord,
} from '@/repositories/types/BillingPersistence';
import { runInTransaction } from '@/lib/mongoose-transaction';
import { objectId, settlementAttemptSnapshot } from './billing-shared';
import { consumePromotion, ensureFirstPurchaseEligibility } from './promotion-lifecycle';
import { fulfillmentWriters, inboxWriters, settlementWriters } from './settlement-writers';

/**
 * Everything settlement needs from persistence, and nothing else.
 *
 * Reads are plain; every write goes through one of the three transaction-bound
 * bundles, which are the only things this adapter hands out. There is no method
 * here that writes anything directly, which is what makes "a money mutation
 * happened outside a durable commit" unrepresentable rather than merely
 * discouraged.
 */
export class BillingSettlementRepository implements IBillingSettlementRepository {
  private readonly entitlementLedger = new EntitlementLedgerRepository();

  /**
   * The latest attempt on an order the caller owns, for settlement. Ownership
   * is enforced here so the settlement handler never has to know about users.
   */
  async findLatestAttemptForOwnedOrder(
    query: OwnedOrderAttemptQuery,
  ): Promise<SettlementAttemptSnapshot | null> {
    await connectDB();
    const order = await BillingOrder.findOne({
      publicId: query.publicId,
      user: objectId(query.userId),
    })
      .select({ _id: 1 })
      .lean<{ _id: Types.ObjectId }>()
      .exec();
    if (!order) throw new BillingDomainError('order_not_found', 'Order not found', 404);
    const attempt = await PaymentAttempt.findOne({ order: order._id })
      .sort({ createdAt: -1 })
      .lean<PaymentAttemptPersistenceRecord>()
      .exec();
    return attempt ? settlementAttemptSnapshot(attempt) : null;
  }

  async findCancellableAttempt(query: OwnedOrderAttemptQuery): Promise<SettlementAttemptSnapshot> {
    await connectDB();
    const order = await BillingOrder.findOne({
      publicId: query.publicId,
      user: objectId(query.userId),
    })
      .lean<BillingOrderPersistenceRecord>()
      .exec();
    if (!order) throw new BillingDomainError('order_not_found', 'Order not found', 404);
    if (order.collectionStatus === 'paid' || order.collectionStatus === 'overpaid') {
      throw new BillingDomainError('payment_state_conflict', 'A paid order cannot be cancelled');
    }
    const attempt = await PaymentAttempt.findOne({ order: order._id, activeForCheckout: true })
      .sort({ createdAt: -1 })
      .lean<PaymentAttemptPersistenceRecord>()
      .exec();
    if (!attempt?.externalOrderId) {
      throw new BillingDomainError('payment_state_conflict', 'No cancellable payment attempt');
    }
    if (!Number.isSafeInteger(Number(attempt.externalOrderId))) {
      throw new BillingDomainError('payment_state_conflict', 'Payment attempt is invalid');
    }
    return settlementAttemptSnapshot(attempt);
  }

  async loadAttemptByExternalOrderId(
    externalOrderId: string,
  ): Promise<SettlementAttemptSnapshot | null> {
    await connectDB();
    const attempt = await PaymentAttempt.findOne({
      provider: 'payos',
      providerAccountId: billingConfig.providerAccountId(),
      environment: billingConfig.providerEnvironment(),
      externalOrderId,
    })
      .lean<PaymentAttemptPersistenceRecord>()
      .exec();
    return attempt ? settlementAttemptSnapshot(attempt) : null;
  }

  /**
   * Takes ownership of one attempt for an event-driven settlement.
   *
   * A webhook and a checkout verification write the same fields a drain writes,
   * so they take the same lease. Without it the two ownership models coexisted:
   * a drain holding a lease could have its escalation overwritten by a webhook
   * that had read a staler snapshot, and neither could tell.
   */
  async acquireAttemptLease(
    input: AcquireAttemptLeaseInput,
  ): Promise<SettlementAttemptSnapshot | null> {
    await connectDB();
    return this.leaseAttempt(
      { _id: new Types.ObjectId(input.attemptRef) },
      input.nowMs,
      input.leaseMs,
      null,
    );
  }

  /**
   * Takes the single oldest due attempt and leases it.
   *
   * Escalated attempts are excluded by status and settled ones drop out when
   * their watch window closes and `nextReconcileAt` is removed, so neither can
   * be re-selected forever. The lease closes the remaining gap: two overlapping
   * ticks used to select the same rows and each make its own provider call for
   * them, doubling outbound traffic and racing each other's transitions.
   *
   * One row per call, taken from inside the drain's budget loop. The previous
   * form leased a whole batch up front and then stopped when the budget ran
   * out, so every row the tick never reached stayed held out of the queue for
   * the full lease — work that looked claimed and was not being done.
   */
  async claimNextDueAttempt(
    input: ClaimDueAttemptInput,
  ): Promise<SettlementAttemptSnapshot | null> {
    await connectDB();
    return this.leaseAttempt(
      {
        collectionStatus: { $in: [...OPEN_ATTEMPT_STATES, ...TERMINAL_ATTEMPT_STATES] },
        nextReconcileAt: { $lte: new Date(input.nowMs) },
      },
      input.nowMs,
      input.leaseMs,
      { nextReconcileAt: 1 },
    );
  }

  /**
   * The one place an attempt lease is minted. A single `findOneAndUpdate` is
   * what makes it a claim rather than a check: two drains cannot come away
   * holding tokens for the same attempt.
   */
  private async leaseAttempt(
    selector: Record<string, unknown>,
    nowMs: number,
    leaseMs: number,
    sort: Record<string, 1 | -1> | null,
  ): Promise<SettlementAttemptSnapshot | null> {
    const now = new Date(nowMs);
    const token = crypto.randomUUID();
    const attempt = await PaymentAttempt.findOneAndUpdate(
      {
        ...selector,
        $or: [{ reconcileLeaseUntil: { $exists: false } }, { reconcileLeaseUntil: { $lt: now } }],
      },
      {
        $set: {
          reconcileLeaseUntil: new Date(nowMs + leaseMs),
          reconcileLeaseToken: token,
        },
      },
      { new: true, ...(sort === null ? {} : { sort }) },
    )
      .lean<PaymentAttemptPersistenceRecord>()
      .exec();
    if (!attempt) return null;
    return settlementAttemptSnapshot(attempt, { attemptRef: attempt._id.toString(), token });
  }

  async listDueFulfillments(input: ClaimDueFulfillmentsInput): Promise<DueFulfillmentOrder[]> {
    await connectDB();
    const orders = await BillingOrder.find({
      fulfillmentStatus: { $in: ['unfulfilled', 'processing'] },
      fulfillmentNextAttemptAt: { $lte: new Date(input.nowMs) },
    })
      .sort({ fulfillmentNextAttemptAt: 1 })
      .limit(input.limit)
      .select({ _id: 1 })
      .lean<Array<{ _id: Types.ObjectId }>>()
      .exec();
    return orders.map((order) => ({ orderRef: order._id.toString() }));
  }

  inSettlementTransaction<T>(work: SettlementWork<T>): Promise<T> {
    return runInTransaction((session) => work(settlementWriters(session)));
  }

  inInboxTransaction<T>(work: InboxWork<T>): Promise<T> {
    return runInTransaction((session) => work(inboxWriters(session)));
  }

  /**
   * First-purchase eligibility is backfilled before the commit opens: it reads
   * three collections in parallel, which a session cannot do, and it is
   * idempotent, so running it outside the commit costs nothing.
   */
  async inFulfillmentTransaction<T>(orderRef: OrderRef, work: FulfillmentWork<T>): Promise<T> {
    await connectDB();
    const order = await BillingOrder.findById(new Types.ObjectId(orderRef))
      .select({ user: 1, eligibilityClass: 1 })
      .lean<{ user: Types.ObjectId; eligibilityClass?: 'first_purchase' }>()
      .exec();
    if (order?.eligibilityClass === 'first_purchase') {
      await ensureFirstPurchaseEligibility(order.user);
    }
    return runInTransaction((session) =>
      work(
        fulfillmentWriters(session, this.entitlementLedger, (record) =>
          consumePromotion(record, session),
        ),
      ),
    );
  }
}
