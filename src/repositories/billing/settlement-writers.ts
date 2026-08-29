import crypto from 'crypto';
import { Types, type ClientSession, type FilterQuery } from 'mongoose';
import {
  BillingOrder,
  ExternalMoneyAdjustment,
  IdempotencyRecord,
  PaymentAttempt,
  PaymentTransaction,
  PaymentWebhookInbox,
  PromotionRedemption,
} from '@/models/Billing';
import type {
  ApplyAttemptTransitionInput,
  ApplyOrderCollectionInput,
  ArmFulfillmentInput,
  AttemptLease,
  AttemptRef,
  AttemptWriteOutcome,
  ClaimFulfillmentInput,
  ClaimInboxEventInput,
  DeferFulfillmentInput,
  EscalateAttemptInput,
  FulfillmentClaim,
  FulfillmentLease,
  FulfillmentWriters,
  GrantEntitlementInput,
  InboxClaim,
  InboxLease,
  InboxWriters,
  LeaseWriteOutcome,
  MarkFulfilledInput,
  MarkFulfillmentReviewInput,
  OrderPaymentSummary,
  OrderRef,
  RecordProviderTransactionInput,
  RescheduleAttemptInput,
  RescheduleFulfillmentInput,
  RescheduleInboxInput,
  SettlementWriters,
  StoredProviderTransaction,
} from '@/interfaces/repositories/IBillingSettlementRepository';
import { BillingDomainError } from '@/services/billing/billing-domain';
import { ORDER_COLLECTION_STATES } from '@/services/billing/domain/order-collection';
import { FULFILLMENT_STATES } from '@/services/billing/domain/fulfillment-decision';
import type { EntitlementLedgerRepository } from '@/repositories/EntitlementLedgerRepository';
import type {
  BillingOrderPersistenceRecord,
  ExternalMoneyAdjustmentPersistenceRecord,
  StoredPaymentTransactionPersistenceRecord,
  WebhookInboxClaimPersistenceRecord,
} from '@/repositories/types/BillingPersistence';
import { assertStoredEnum, ENTITLED_ORDER_EXPRESSION, toLedgerAdjustments } from './billing-shared';

/**
 * The three transaction-bound write bundles settlement runs on.
 *
 * A bundle is created inside a transaction and closes over that session, so
 * there is no ambient session to forget to pass, no generic update method, and
 * no way to express a write that is not part of a durable commit. Money and
 * fulfillment get separate bundles because an entitlement conflict must never
 * roll back money the provider has already taken.
 *
 * Every bundle is also fenced. A claim mints a token, the claimant quotes it on
 * each write, and the filter carries it — so a worker whose lease expired
 * matches nothing once someone else has claimed the same row. Ownership is
 * never inferred from a timestamp.
 */

interface OrderPaymentAggregate {
  _id: null;
  received: number;
  earliestPaidAt: Date | null;
}

interface AttemptReceivedAggregate {
  _id: null;
  received: number;
}

/** Clears the queue claim a drain took, whatever the outcome of the write. */
const RELEASE_RECONCILE_LEASE = { reconcileLeaseUntil: 1, reconcileLeaseToken: 1 } as const;

/** The filter half of every fenced attempt write. */
function attemptFence(lease: AttemptLease): FilterQuery<unknown> {
  return {
    _id: new Types.ObjectId(lease.attemptRef),
    reconcileLeaseToken: lease.token,
  };
}

function leaseOutcome(matchedCount: number): LeaseWriteOutcome {
  return matchedCount === 1 ? 'applied' : 'lease_lost';
}

export function settlementWriters(session: ClientSession): SettlementWriters {
  return {
    recordProviderTransaction: async (
      input: RecordProviderTransactionInput,
    ): Promise<StoredProviderTransaction> => {
      const key = {
        provider: 'payos',
        providerAccountId: input.providerAccountId,
        environment: input.environment,
        transactionType: 'payment',
        externalReference: input.reference,
      };
      const stored = await PaymentTransaction.findOneAndUpdate(
        key,
        {
          $setOnInsert: {
            ...key,
            attempt: new Types.ObjectId(input.attemptRef),
            order: new Types.ObjectId(input.orderRef),
            currency: input.currency,
            signedAmount: input.amountMinor,
            direction: 'incoming',
            providerEventAt: new Date(input.occurredAtMs),
            settlementState: 'confirmed',
            rawPayloadHash: input.rawPayloadHash,
          },
        },
        { upsert: true, new: true, session },
      )
        .lean<StoredPaymentTransactionPersistenceRecord>()
        .exec();
      if (!stored) {
        throw new BillingDomainError(
          'payment_processing_failed',
          'Provider transaction was not recorded',
          500,
        );
      }
      return {
        attemptRef: stored.attempt.toString(),
        orderRef: stored.order.toString(),
        currency: stored.currency,
        signedAmountMinor: stored.signedAmount,
      };
    },

    applyAttemptTransition: async (
      input: ApplyAttemptTransitionInput,
    ): Promise<AttemptWriteOutcome> => {
      const result = await PaymentAttempt.updateOne(
        {
          ...attemptFence(input.lease),
          version: input.expectedVersion,
          collectionStatus: input.expectedStatus,
        },
        {
          $set: {
            paymentLinkId: input.paymentLinkId,
            amountPaid: input.amountPaidMinor,
            amountRemaining: input.amountRemainingMinor,
            collectionStatus: input.status,
            activeForCheckout: input.activeForCheckout,
            ...(input.settledAtMs === null
              ? {}
              : { terminalConfirmedAt: new Date(input.settledAtMs) }),
            ...(input.nextReconcileAtMs === null
              ? {}
              : { nextReconcileAt: new Date(input.nextReconcileAtMs) }),
          },
          // Removing the field, rather than pushing it far out, is what takes a
          // finished attempt out of the due selector for good.
          $unset:
            input.nextReconcileAtMs === null
              ? { nextReconcileAt: 1, ...RELEASE_RECONCILE_LEASE }
              : { ...RELEASE_RECONCILE_LEASE },
          $inc: { reconcileCount: 1, version: 1 },
        },
        { session },
      );
      if (result.matchedCount === 1) return 'applied';
      // Losing the optimistic race and losing the lease need different answers
      // from the caller, so read which one happened while still in session.
      return (await attemptLeaseHeld(session, input.lease)) ? 'stale' : 'lease_lost';
    },

    sumAttemptReceivedMinor: async (attemptRef: AttemptRef): Promise<number> => {
      const aggregates = await PaymentTransaction.aggregate<AttemptReceivedAggregate>([
        {
          $match: {
            attempt: new Types.ObjectId(attemptRef),
            transactionType: 'payment',
            direction: 'incoming',
          },
        },
        { $group: { _id: null, received: { $sum: '$signedAmount' } } },
      ]).session(session);
      return aggregates[0]?.received ?? 0;
    },

    summarizeOrderPayments: async (orderRef: OrderRef): Promise<OrderPaymentSummary | null> => {
      const orderId = new Types.ObjectId(orderRef);
      const aggregates = await PaymentTransaction.aggregate<OrderPaymentAggregate>([
        { $match: { order: orderId, transactionType: 'payment', direction: 'incoming' } },
        {
          $group: {
            _id: null,
            received: { $sum: '$signedAmount' },
            earliestPaidAt: { $min: '$providerEventAt' },
          },
        },
      ]).session(session);
      const order = await BillingOrder.findById(orderId)
        .session(session)
        .lean<BillingOrderPersistenceRecord>()
        .exec();
      if (!order) return null;
      // Read under the same snapshot as the payments: the collection projection
      // this feeds is what the fulfillment claim fences on, so it must not be
      // assembled from two different points in time.
      const adjustments = await ExternalMoneyAdjustment.find({ order: orderId })
        .select({ type: 1, allocation: 1, amount: 1 })
        .session(session)
        .lean<ExternalMoneyAdjustmentPersistenceRecord[]>()
        .exec();
      return {
        receivedMinor: aggregates[0]?.received ?? 0,
        earliestPaidAtMs: aggregates[0]?.earliestPaidAt?.getTime() ?? null,
        finalMinor: order.finalAmount,
        adjustments: toLedgerAdjustments(adjustments),
        collectionStatus: assertStoredEnum(
          ORDER_COLLECTION_STATES,
          order.collectionStatus,
          'order collection status',
        ),
        fulfillmentStatus: assertStoredEnum(
          FULFILLMENT_STATES,
          order.fulfillmentStatus,
          'fulfillment status',
        ),
      };
    },

    applyOrderCollection: async (input: ApplyOrderCollectionInput): Promise<void> => {
      const orderId = new Types.ObjectId(input.orderRef);
      await BillingOrder.updateOne(
        { _id: orderId },
        {
          $set: {
            receivedAmount: input.receivedMinor,
            netPrincipalAmount: input.netPrincipalMinor,
            excessAmount: input.excessMinor,
            // Both are projections of the one ledger the caller derived them
            // from, so neither can contradict the other or the entitlement.
            settlementStatus: input.settlementStatus,
            excessResolution: input.excessResolution,
            ...(input.providerPaidAtMs === null
              ? {}
              : { providerPaidAt: new Date(input.providerPaidAtMs) }),
          },
          // `$min` writes the field when it is absent and keeps the earlier of
          // the two otherwise, so re-observing an order that was already
          // complete cannot move the instant its backoff ages from.
          ...(input.fullyCollectedAtMs === null
            ? {}
            : { $min: { fullyCollectedAt: new Date(input.fullyCollectedAtMs) } }),
          $inc: { version: 1 },
        },
        { session },
      );
      // An order an operator owns stays theirs: a later clean observation
      // refreshes the amounts but must not wash it out of review.
      await BillingOrder.updateOne(
        { _id: orderId, collectionStatus: { $ne: 'review' } },
        { $set: { collectionStatus: input.collectionStatus } },
        { session },
      );
    },

    armFulfillment: async (input: ArmFulfillmentInput): Promise<boolean> => {
      const result = await BillingOrder.updateOne(
        {
          _id: new Types.ObjectId(input.orderRef),
          collectionStatus: { $ne: 'review' },
          fulfillmentStatus: { $in: ['unfulfilled', 'processing'] },
          $expr: ENTITLED_ORDER_EXPRESSION,
        },
        {
          $set: { fulfillmentNextAttemptAt: new Date(input.dueAtMs) },
          $unset: { fulfillmentLeaseUntil: 1, fulfillmentLeaseToken: 1 },
        },
        { session },
      );
      return result.matchedCount === 1;
    },

    completeOrderIdempotency: async (orderRef: OrderRef): Promise<void> => {
      await IdempotencyRecord.updateMany(
        { order: new Types.ObjectId(orderRef), status: 'processing' },
        {
          $set: {
            status: 'completed',
            responseStatus: 201,
            responseBodySnapshot: { orderId: orderRef },
          },
        },
        { session },
      );
    },

    escalateAttempt: async (input: EscalateAttemptInput): Promise<LeaseWriteOutcome> => {
      const result = await PaymentAttempt.updateOne(
        attemptFence(input.lease),
        {
          $set: { collectionStatus: 'review', lastProviderError: input.reason },
          $unset: { nextReconcileAt: 1, ...RELEASE_RECONCILE_LEASE },
          $inc: { version: 1 },
        },
        { session },
      );
      // A worker that no longer owns the attempt does not get to freeze the
      // order either: by the time its lease expired the order may have been
      // settled and fulfilled by the worker that took over.
      if (result.matchedCount !== 1) return 'lease_lost';
      if (!input.freezesOrder) return 'applied';
      await BillingOrder.updateOne(
        { _id: new Types.ObjectId(input.orderRef) },
        { $set: { collectionStatus: 'review' }, $inc: { version: 1 } },
        { session },
      );
      return 'applied';
    },

    rescheduleAttempt: async (input: RescheduleAttemptInput): Promise<LeaseWriteOutcome> => {
      const result = await PaymentAttempt.updateOne(
        attemptFence(input.lease),
        {
          $set: {
            nextReconcileAt: new Date(input.nextReconcileAtMs),
            ...(input.lastProviderError === null
              ? {}
              : { lastProviderError: input.lastProviderError }),
          },
          $unset: { ...RELEASE_RECONCILE_LEASE },
          $inc: { reconcileCount: 1, version: 1 },
        },
        { session },
      );
      return leaseOutcome(result.matchedCount);
    },

    markPromotionReleaseDue: async (orderRef: OrderRef): Promise<void> => {
      await PromotionRedemption.updateOne(
        { order: new Types.ObjectId(orderRef), status: 'reserved' },
        { $set: { nextReleaseCheckAt: new Date() } },
        { session },
      );
    },
  };
}

async function attemptLeaseHeld(session: ClientSession, lease: AttemptLease): Promise<boolean> {
  const current = await PaymentAttempt.findById(new Types.ObjectId(lease.attemptRef))
    .select({ reconcileLeaseToken: 1 })
    .session(session)
    .lean<{ reconcileLeaseToken?: string }>()
    .exec();
  return current?.reconcileLeaseToken === lease.token;
}

/**
 * The webhook inbox bundle. Claiming is a lease rather than a delete, so a
 * worker that dies mid-event returns the event to the queue instead of losing
 * it, and the attempt count that eventually dead-letters a poison event
 * survives with it.
 */
export function inboxWriters(session: ClientSession): InboxWriters {
  return {
    claim: async (input: ClaimInboxEventInput): Promise<InboxClaim | null> => {
      const now = new Date(input.nowMs);
      const token = crypto.randomUUID();
      const event = await PaymentWebhookInbox.findOneAndUpdate(
        {
          status: { $in: ['verified', 'processing', 'retryable_failure', 'orphaned'] },
          nextAttemptAt: { $lte: now },
          $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lt: now } }],
        },
        {
          $set: {
            status: 'processing',
            leaseUntil: new Date(input.nowMs + input.leaseMs),
            leaseToken: token,
          },
          $inc: { attemptCount: 1 },
        },
        { new: true, sort: { nextAttemptAt: 1 }, session },
      )
        .lean<WebhookInboxClaimPersistenceRecord>()
        .exec();
      if (!event) return null;
      return {
        lease: { inboxRef: event._id.toString(), token },
        orderCode: event.orderCode ?? null,
        attemptCount: event.attemptCount,
        createdAtMs: event.createdAt.getTime(),
      };
    },

    markProcessed: async (lease: InboxLease): Promise<LeaseWriteOutcome> => {
      const result = await PaymentWebhookInbox.updateOne(
        { _id: new Types.ObjectId(lease.inboxRef), leaseToken: lease.token, status: 'processing' },
        {
          $set: { status: 'processed', processedAt: new Date() },
          $unset: { leaseUntil: 1, leaseToken: 1 },
        },
        { session },
      );
      return leaseOutcome(result.matchedCount);
    },

    reschedule: async (input: RescheduleInboxInput): Promise<LeaseWriteOutcome> => {
      const result = await PaymentWebhookInbox.updateOne(
        {
          _id: new Types.ObjectId(input.lease.inboxRef),
          leaseToken: input.lease.token,
          status: 'processing',
        },
        {
          $set: {
            status: input.status,
            nextAttemptAt: new Date(input.nextAttemptAtMs),
            ...(input.lastError === null ? {} : { lastError: input.lastError }),
          },
          $unset: { leaseUntil: 1, leaseToken: 1 },
        },
        { session },
      );
      return leaseOutcome(result.matchedCount);
    },
  };
}

export type ConsumeOrderPromotion = (order: BillingOrderPersistenceRecord) => Promise<void>;

/**
 * The fulfillment bundle. Nothing here can reach a transaction, an attempt or
 * an order's collected amount: money is observed by `settlementWriters` and
 * stays committed no matter what fulfillment decides.
 */
export function fulfillmentWriters(
  session: ClientSession,
  ledger: EntitlementLedgerRepository,
  consumeOrderPromotion: ConsumeOrderPromotion,
): FulfillmentWriters {
  return {
    claim: async (input: ClaimFulfillmentInput): Promise<FulfillmentClaim | null> => {
      const now = new Date(input.nowMs);
      // A fresh token per claim is what makes ownership checkable afterwards.
      // The filter below is the only place a lease can be taken, so two
      // workers can never come away holding the same token for one order.
      const token = crypto.randomUUID();
      const order = await BillingOrder.findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.orderRef),
          fulfillmentNextAttemptAt: { $lte: now },
          $or: [
            { fulfillmentLeaseUntil: { $exists: false } },
            { fulfillmentLeaseUntil: { $lt: now } },
          ],
        },
        {
          $set: {
            fulfillmentLeaseUntil: new Date(input.nowMs + input.leaseMs),
            fulfillmentLeaseToken: token,
          },
          $inc: { fulfillmentAttemptCount: 1 },
        },
        { new: true, session },
      )
        .lean<BillingOrderPersistenceRecord>()
        .exec();
      if (!order) return null;
      return {
        orderRef: order._id.toString(),
        lease: { orderRef: order._id.toString(), token },
        userRef: order.user.toString(),
        planId: order.planId,
        planName: order.planName,
        durationUnit: order.durationUnit,
        durationValue: order.durationValue,
        // Read from the claim itself, so the decision below is made against the
        // order as it stood the instant this worker took it — not against a
        // number read separately and already stale.
        entitled: (order.netPrincipalAmount ?? order.receivedAmount) >= order.finalAmount,
        collectionUnderReview:
          assertStoredEnum(
            ORDER_COLLECTION_STATES,
            order.collectionStatus,
            'order collection status',
          ) === 'review',
        fulfillmentStatus: assertStoredEnum(
          FULFILLMENT_STATES,
          order.fulfillmentStatus,
          'order fulfillment status',
        ),
        providerPaidAtMs: order.providerPaidAt?.getTime() ?? null,
        // `providerPaidAt` is the earliest incoming transaction, which for an
        // order part-paid months ago is nowhere near when it became payable.
        // Rows written before `fullyCollectedAt` existed fall back to their
        // creation instant rather than to a deposit from another quarter.
        collectedAtMs: (order.fullyCollectedAt ?? order.createdAt).getTime(),
        // Counted by the claim above, so this attempt is included.
        attemptCount: order.fulfillmentAttemptCount,
      };
    },

    grantEntitlement: async (input: GrantEntitlementInput): Promise<void> => {
      await ledger.appendGrant(
        {
          user: new Types.ObjectId(input.userRef),
          sourceType: 'billing_order',
          sourceId: input.orderRef,
          planId: input.planId,
          planName: input.planName,
          durationUnit: input.durationUnit,
          durationValue: input.durationValue,
          committedAt: new Date(input.committedAtMs),
          ...(input.providerPaidAtMs === null
            ? {}
            : { providerPaidAt: new Date(input.providerPaidAtMs) }),
        },
        session,
      );
    },

    consumePromotion: async (orderRef: OrderRef): Promise<void> => {
      const order = await BillingOrder.findById(new Types.ObjectId(orderRef))
        .session(session)
        .lean<BillingOrderPersistenceRecord>()
        .exec();
      if (!order) return;
      await consumeOrderPromotion(order);
    },

    /**
     * The single atomic point where a grant becomes real.
     *
     * The filter carries the entitlement predicate as well as the lease, so a
     * refund or chargeback committed between the claim and here matches nothing
     * and rolls the whole commit — grant included — back. That is the fence
     * that makes "money came back concurrently with fulfillment" resolve one
     * way rather than by whichever transaction happened to be quicker.
     */
    markFulfilled: async (input: MarkFulfilledInput): Promise<void> => {
      const orderId = new Types.ObjectId(input.lease.orderRef);
      const result = await BillingOrder.updateOne(
        {
          _id: orderId,
          fulfillmentLeaseToken: input.lease.token,
          fulfillmentStatus: { $in: ['unfulfilled', 'processing'] },
          collectionStatus: { $ne: 'review' },
          $expr: ENTITLED_ORDER_EXPRESSION,
        },
        {
          $set: { fulfillmentStatus: 'fulfilled', fulfilledAt: new Date(input.fulfilledAtMs) },
          $unset: {
            fulfillmentNextAttemptAt: 1,
            fulfillmentLeaseUntil: 1,
            fulfillmentLeaseToken: 1,
            fulfillmentLastError: 1,
          },
          $inc: { version: 1 },
        },
        { session },
      );
      if (result.matchedCount === 1) return;
      // The commit rolls back either way — a grant must not survive without
      // the order that records it — but the caller answers the three cases
      // differently, so read which one happened while still in session.
      const current = await BillingOrder.findById(orderId)
        .select({
          fulfillmentLeaseToken: 1,
          netPrincipalAmount: 1,
          receivedAmount: 1,
          finalAmount: 1,
        })
        .session(session)
        .lean<
          Pick<
            BillingOrderPersistenceRecord,
            'fulfillmentLeaseToken' | 'netPrincipalAmount' | 'receivedAmount' | 'finalAmount'
          >
        >()
        .exec();
      if (current?.fulfillmentLeaseToken !== input.lease.token) {
        throw new BillingDomainError(
          'fulfillment_lease_lost',
          'Fulfillment lease was taken by another worker',
          409,
        );
      }
      if ((current.netPrincipalAmount ?? current.receivedAmount) < current.finalAmount) {
        throw new BillingDomainError(
          'fulfillment_not_entitled',
          'The order stopped covering what it is owed during fulfillment',
          409,
        );
      }
      throw new BillingDomainError(
        'fulfillment_state_conflict',
        'Order left the fulfillable state during fulfillment',
        409,
      );
    },

    markForReview: async (input: MarkFulfillmentReviewInput): Promise<LeaseWriteOutcome> => {
      const result = await BillingOrder.updateOne(
        { _id: new Types.ObjectId(input.lease.orderRef), fulfillmentLeaseToken: input.lease.token },
        {
          $set: { fulfillmentStatus: 'review', fulfillmentLastError: input.reason },
          // Review is operator-owned: the order leaves the automatic queue and
          // only an operator can put it back.
          $unset: {
            fulfillmentNextAttemptAt: 1,
            fulfillmentLeaseUntil: 1,
            fulfillmentLeaseToken: 1,
          },
          $inc: { version: 1 },
        },
        { session },
      );
      return leaseOutcome(result.matchedCount);
    },

    reschedule: async (input: RescheduleFulfillmentInput): Promise<LeaseWriteOutcome> => {
      const result = await BillingOrder.updateOne(
        { _id: new Types.ObjectId(input.lease.orderRef), fulfillmentLeaseToken: input.lease.token },
        {
          $set: {
            fulfillmentNextAttemptAt: new Date(input.dueAtMs),
            ...(input.lastError === null ? {} : { fulfillmentLastError: input.lastError }),
          },
          $unset: { fulfillmentLeaseUntil: 1, fulfillmentLeaseToken: 1 },
        },
        { session },
      );
      return leaseOutcome(result.matchedCount);
    },

    deferForManualActivation: async (input: DeferFulfillmentInput): Promise<LeaseWriteOutcome> => {
      const orderId = new Types.ObjectId(input.lease.orderRef);
      await BillingOrder.updateOne(
        {
          _id: orderId,
          fulfillmentLeaseToken: input.lease.token,
          fulfillmentStatus: 'unfulfilled',
        },
        { $set: { fulfillmentStatus: 'processing' }, $inc: { version: 1 } },
        { session },
      );
      const result = await BillingOrder.updateOne(
        { _id: orderId, fulfillmentLeaseToken: input.lease.token },
        {
          $set: {
            fulfillmentNextAttemptAt: new Date(input.recheckAtMs),
            fulfillmentAttemptCount: 0,
          },
          $unset: { fulfillmentLeaseUntil: 1, fulfillmentLeaseToken: 1 },
        },
        { session },
      );
      return leaseOutcome(result.matchedCount);
    },

    releaseLease: async (lease: FulfillmentLease): Promise<LeaseWriteOutcome> => {
      const result = await BillingOrder.updateOne(
        { _id: new Types.ObjectId(lease.orderRef), fulfillmentLeaseToken: lease.token },
        {
          $unset: {
            fulfillmentLeaseUntil: 1,
            fulfillmentLeaseToken: 1,
            fulfillmentNextAttemptAt: 1,
          },
        },
        { session },
      );
      return leaseOutcome(result.matchedCount);
    },
  };
}
