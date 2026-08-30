import { runInTransaction } from '@/lib/mongoose-transaction';
import { Types, type ClientSession } from 'mongoose';
import connectDB from '@/lib/mongoose';
import { BillingOrder, ExternalMoneyAdjustment, PaymentTransaction } from '@/models/Billing';
import type { BillingOrderView } from '@/interfaces/repositories/IBillingOrderRepository';
import type {
  AdjustmentOrderSnapshot,
  AdjustmentReference,
  AdjustmentWork,
  AdjustmentWriters,
  ApplyLedgerProjectionInput,
  ArmOrderFulfillmentInput,
  EntitlementAdjustmentInput,
  IBillingAdjustmentRepository,
  InsertAdjustmentInput,
  RecordExcessVerdictInput,
  StoredAdjustmentIdentity,
} from '@/interfaces/repositories/IBillingAdjustmentRepository';
import { BillingDomainError } from '@/services/billing/billing-domain';
import { billingConfig } from '@/services/billing/billing-config';
import { EXCESS_RESOLUTIONS } from '@/services/billing/domain/excess-resolution';
import {
  FULFILLMENT_STATES,
  type FulfillmentState,
} from '@/services/billing/domain/fulfillment-decision';
import { EntitlementLedgerRepository } from '@/repositories/EntitlementLedgerRepository';
import type {
  BillingOrderPersistenceRecord,
  ExternalMoneyAdjustmentPersistenceRecord,
} from '@/repositories/types/BillingPersistence';
import {
  assertStoredEnum,
  ENTITLED_ORDER_EXPRESSION,
  objectId,
  toLedgerAdjustments,
  toOrderView,
} from './billing-shared';

/**
 * The adjustment ledger's persistence adapter.
 *
 * It reads and it writes; it decides nothing. Admissibility, what a reused
 * external reference means and what an adjustment does to the customer's
 * entitlement all live in `services/billing/adjustments`, where they can be
 * tested without a database and cannot quietly acquire a second copy inside a
 * repository method.
 */

interface StoredAdjustmentRecord {
  order: Types.ObjectId;
  amount: number;
  currency: string;
  allocation: string;
  occurredAt: Date;
}

interface AdjustedOrderRecord {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  currency: string;
  finalAmount: number;
  receivedAmount: number;
  fulfillmentStatus: string;
  excessResolution: string;
}

function namespaceFor(reference: AdjustmentReference): Record<string, string> {
  return {
    provider: 'payos',
    providerAccountId: billingConfig.providerAccountId(),
    environment: billingConfig.providerEnvironment(),
    type: reference.type,
    externalReference: reference.externalReference.trim(),
  };
}

/** The ledger identity a grant adjustment is deduped on. */
interface EntitlementSourceIdentity {
  user: Types.ObjectId;
  sourceType: 'billing_order';
  sourceId: string;
  adjustmentSourceId: string;
}

function entitlementIdentity(input: EntitlementAdjustmentInput): EntitlementSourceIdentity {
  return {
    user: new Types.ObjectId(input.userRef),
    sourceType: 'billing_order',
    sourceId: input.orderRef,
    adjustmentSourceId: `${input.reference.type}:${input.reference.externalReference}`,
  };
}

function adjustmentWriters(
  session: ClientSession,
  ledger: EntitlementLedgerRepository,
): AdjustmentWriters {
  return {
    loadOrder: async (orderRef: string): Promise<AdjustmentOrderSnapshot | null> => {
      const orderId = new Types.ObjectId(orderRef);
      const order = await BillingOrder.findById(orderId)
        .session(session)
        .select({
          user: 1,
          currency: 1,
          finalAmount: 1,
          receivedAmount: 1,
          fulfillmentStatus: 1,
          excessResolution: 1,
        })
        .lean<AdjustedOrderRecord>()
        .exec();
      if (!order) return null;
      const payment = await PaymentTransaction.findOne({
        order: orderId,
        transactionType: 'payment',
        direction: 'incoming',
      })
        .sort({ providerEventAt: 1 })
        .session(session)
        .select({ _id: 1 })
        .lean<{ _id: Types.ObjectId }>()
        .exec();
      const stored = await ExternalMoneyAdjustment.find({ order: orderId })
        .session(session)
        .select({ type: 1, allocation: 1, amount: 1 })
        .lean<ExternalMoneyAdjustmentPersistenceRecord[]>()
        .exec();
      return {
        orderRef,
        userRef: order.user.toString(),
        currency: order.currency,
        finalMinor: order.finalAmount,
        receivedMinor: order.receivedAmount,
        fulfillmentStatus: assertStoredEnum(
          FULFILLMENT_STATES,
          order.fulfillmentStatus,
          'fulfillment status',
        ),
        excessResolution: assertStoredEnum(
          EXCESS_RESOLUTIONS,
          order.excessResolution,
          'excess resolution',
        ),
        adjustments: toLedgerAdjustments(stored),
        paymentTransactionRef: payment?._id.toString() ?? null,
      };
    },

    insertAdjustment: async (input: InsertAdjustmentInput): Promise<void> => {
      await ExternalMoneyAdjustment.create(
        [
          {
            order: new Types.ObjectId(input.orderRef),
            paymentTransaction: new Types.ObjectId(input.paymentTransactionRef),
            ...namespaceFor(input.reference),
            amount: input.amountMinor,
            currency: input.currency,
            allocation: input.allocation,
            occurredAt: new Date(input.occurredAtMs),
            recordedBy: objectId(input.recordedBy),
          },
        ],
        { session },
      );
    },

    applyLedgerProjection: async (input: ApplyLedgerProjectionInput): Promise<void> => {
      await BillingOrder.updateOne(
        { _id: new Types.ObjectId(input.orderRef) },
        {
          $set: {
            netPrincipalAmount: input.netPrincipalMinor,
            settlementStatus: input.settlementStatus,
            excessResolution: input.excessResolution,
          },
          $inc: { version: 1 },
        },
        { session },
      );
    },

    cancelQueuedFulfillment: async (orderRef: string): Promise<void> => {
      await BillingOrder.updateOne(
        { _id: new Types.ObjectId(orderRef) },
        {
          // Dropping the token is what fences a worker that is mid-grant right
          // now: its commit quotes the token it claimed with, and that token no
          // longer exists, so the grant rolls back with it.
          $unset: {
            fulfillmentNextAttemptAt: 1,
            fulfillmentLeaseUntil: 1,
            fulfillmentLeaseToken: 1,
          },
          $inc: { version: 1 },
        },
        { session },
      );
    },

    armFulfillment: async (input: ArmOrderFulfillmentInput): Promise<boolean> => {
      const result = await BillingOrder.updateOne(
        {
          _id: new Types.ObjectId(input.orderRef),
          collectionStatus: { $ne: 'review' },
          $expr: ENTITLED_ORDER_EXPRESSION,
        },
        {
          $set: {
            fulfillmentNextAttemptAt: new Date(input.dueAtMs),
            fulfillmentAttemptCount: 0,
          },
          $unset: { fulfillmentLeaseUntil: 1, fulfillmentLeaseToken: 1 },
        },
        { session },
      );
      return result.matchedCount === 1;
    },

    setFulfillmentStatus: async (orderRef: string, status: FulfillmentState): Promise<void> => {
      await BillingOrder.updateOne(
        { _id: new Types.ObjectId(orderRef) },
        { $set: { fulfillmentStatus: status }, $inc: { version: 1 } },
        { session },
      );
    },

    revokeEntitlement: (input: EntitlementAdjustmentInput): Promise<string | null> =>
      ledger.revokeGrantBySource(
        {
          ...entitlementIdentity(input),
          adjustmentSourceType: input.reference.type === 'chargeback' ? 'chargeback' : 'refund',
          reason: input.reason,
        },
        session,
      ),

    restoreEntitlement: (input: EntitlementAdjustmentInput): Promise<string | null> =>
      ledger.restoreGrantBySource(
        { ...entitlementIdentity(input), adjustmentSourceType: 'reversal', reason: input.reason },
        session,
      ),

    /**
     * The operator's stated reason for a disposal, written in the same commit
     * as the adjustment that disposed of it.
     *
     * There is deliberately no filter on `excessResolution` here: the ledger
     * projection earlier in this very commit has already moved it off
     * `unallocated`, so such a filter would match nothing and refuse every
     * verdict. What actually serialises two operators is the commit itself —
     * both write this order, one loses the write conflict, retries, re-reads a
     * resolved overpayment and is refused before it gets here.
     */
    recordExcessVerdict: async (input: RecordExcessVerdictInput): Promise<boolean> => {
      const result = await BillingOrder.updateOne(
        { _id: new Types.ObjectId(input.orderRef) },
        {
          $set: {
            excessResolutionReason: input.reason,
            excessResolvedAt: new Date(input.resolvedAtMs),
            excessResolvedBy: objectId(input.recordedBy),
          },
        },
        { session },
      );
      return result.matchedCount === 1;
    },
  };
}

export class BillingAdjustmentRepository implements IBillingAdjustmentRepository {
  private readonly entitlementLedger = new EntitlementLedgerRepository();

  async findOrderRef(publicId: string): Promise<string> {
    await connectDB();
    const target = await BillingOrder.findOne({ publicId })
      .select({ _id: 1 })
      .lean<{ _id: Types.ObjectId }>()
      .exec();
    if (!target) throw new BillingDomainError('order_not_found', 'Order not found', 404);
    return target._id.toString();
  }

  async findAdjustmentByReference(
    reference: AdjustmentReference,
  ): Promise<StoredAdjustmentIdentity | null> {
    await connectDB();
    const existing = await ExternalMoneyAdjustment.findOne(namespaceFor(reference))
      .select({ order: 1, amount: 1, currency: 1, allocation: 1, occurredAt: 1 })
      .lean<StoredAdjustmentRecord>()
      .exec();
    if (!existing) return null;
    return {
      orderRef: existing.order.toString(),
      amountMinor: existing.amount,
      currency: existing.currency,
      allocation: assertStoredEnum(
        ['principal', 'excess'] as const,
        existing.allocation,
        'money allocation',
      ),
      occurredAtMs: existing.occurredAt.getTime(),
    };
  }

  async readOrderView(orderRef: string): Promise<BillingOrderView> {
    await connectDB();
    const order = await BillingOrder.findById(new Types.ObjectId(orderRef))
      .lean<BillingOrderPersistenceRecord>()
      .exec();
    if (!order) throw new BillingDomainError('order_not_found', 'Order not found', 404);
    return toOrderView(order);
  }

  inAdjustmentTransaction<T>(work: AdjustmentWork<T>): Promise<T> {
    return runInTransaction((session) => work(adjustmentWriters(session, this.entitlementLedger)));
  }
}
