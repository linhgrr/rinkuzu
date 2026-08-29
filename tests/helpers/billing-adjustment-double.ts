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
import type { ExcessResolution } from '@/services/billing/domain/excess-resolution';
import type { FulfillmentState } from '@/services/billing/domain/fulfillment-decision';
import type { LedgerAdjustment, SettlementState } from '@/services/billing/domain/settlement-math';

/**
 * An in-memory stand-in for the adjustment persistence port.
 *
 * It models the two things the handler's correctness rests on: a commit is all
 * or nothing, and a reused external reference is a duplicate-key error rather
 * than a silent overwrite. Everything else — what an adjustment means for the
 * entitlement, whether the ledger admits it, what a reused reference implies —
 * is the handler's, which is exactly why it can be driven from here.
 */

const DUPLICATE_KEY = 11000;

/** The shape Mongo raises on a unique-index violation. */
export class FakeDuplicateKeyError extends Error {
  readonly code = DUPLICATE_KEY;

  constructor(readonly indexName: string) {
    super(`E11000 duplicate key error collection: test index: ${indexName}`);
    this.name = 'MongoServerError';
  }
}

export interface FakeAdjustmentOrder {
  orderRef: string;
  publicId: string;
  userRef: string;
  currency: string;
  finalMinor: number;
  receivedMinor: number;
  netPrincipalMinor: number;
  settlementStatus: SettlementState;
  excessResolution: ExcessResolution;
  fulfillmentStatus: FulfillmentState;
  fulfillmentDueAtMs: number | null;
  fulfillmentLeaseToken: string | null;
  paymentTransactionRef: string | null;
  excessReason: string | null;
  /** Grants this order produced, and whether each is currently revoked. */
  granted: boolean;
  revoked: boolean;
}

export interface StoredFakeAdjustment extends StoredAdjustmentIdentity {
  reference: AdjustmentReference;
  ledger: LedgerAdjustment;
  recordedBy: string;
}

export interface FakeAdjustmentOptions {
  /**
   * Raised from the next `insertAdjustment`, modelling a unique-index
   * collision that is *not* this reference's — the case the handler must
   * rethrow rather than report as a successful replay.
   */
  insertError?: Error;
}

export class FakeAdjustmentRepository implements IBillingAdjustmentRepository {
  readonly orders = new Map<string, FakeAdjustmentOrder>();
  readonly adjustments: StoredFakeAdjustment[] = [];
  readonly entitlementEvents: Array<{ kind: 'revoke' | 'restore'; orderRef: string }> = [];
  private insertError: Error | undefined;

  constructor(options: FakeAdjustmentOptions = {}) {
    this.insertError = options.insertError;
  }

  seedOrder(
    overrides: Partial<FakeAdjustmentOrder> & Pick<FakeAdjustmentOrder, 'orderRef' | 'publicId'>,
  ): FakeAdjustmentOrder {
    const received = overrides.receivedMinor ?? 100_000;
    const order: FakeAdjustmentOrder = {
      userRef: 'user-1',
      currency: 'VND',
      finalMinor: 100_000,
      receivedMinor: received,
      netPrincipalMinor: received,
      settlementStatus: received >= 100_000 ? 'settled' : 'unsettled',
      excessResolution: 'none',
      fulfillmentStatus: 'unfulfilled',
      fulfillmentDueAtMs: null,
      fulfillmentLeaseToken: null,
      paymentTransactionRef: 'txn-1',
      excessReason: null,
      granted: false,
      revoked: false,
      ...overrides,
    };
    this.orders.set(order.orderRef, order);
    return order;
  }

  private requireOrder(orderRef: string): FakeAdjustmentOrder {
    const order = this.orders.get(orderRef);
    if (!order) throw new Error(`Unknown order ${orderRef}`);
    return order;
  }

  private ledgerFor(orderRef: string): LedgerAdjustment[] {
    return this.adjustments
      .filter((entry) => entry.orderRef === orderRef)
      .map((entry) => entry.ledger);
  }

  async findOrderRef(publicId: string): Promise<string> {
    for (const order of this.orders.values()) {
      if (order.publicId === publicId) return order.orderRef;
    }
    throw new BillingDomainError('order_not_found', 'Order not found', 404);
  }

  async findAdjustmentByReference(
    reference: AdjustmentReference,
  ): Promise<StoredAdjustmentIdentity | null> {
    return (
      this.adjustments.find(
        (entry) =>
          entry.reference.type === reference.type &&
          entry.reference.externalReference === reference.externalReference,
      ) ?? null
    );
  }

  async readOrderView(orderRef: string): Promise<BillingOrderView> {
    const order = this.requireOrder(orderRef);
    return {
      id: order.publicId,
      plan: { id: 'plan-premium', name: 'Premium' },
      currency: 'VND',
      baseAmount: order.finalMinor,
      discountAmount: 0,
      finalAmount: order.finalMinor,
      receivedAmount: order.receivedMinor,
      excessAmount: Math.max(0, order.receivedMinor - order.finalMinor),
      excessResolution: order.excessResolution,
      collectionStatus: 'paid',
      fulfillmentStatus: order.fulfillmentStatus,
      settlementStatus: order.settlementStatus,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };
  }

  async inAdjustmentTransaction<T>(work: AdjustmentWork<T>): Promise<T> {
    const orders = new Map([...this.orders].map(([key, value]) => [key, { ...value }]));
    const adjustments = [...this.adjustments];
    const events = [...this.entitlementEvents];
    const writers: AdjustmentWriters = {
      loadOrder: async (orderRef: string): Promise<AdjustmentOrderSnapshot | null> => {
        const order = this.orders.get(orderRef);
        if (!order) return null;
        return {
          orderRef: order.orderRef,
          userRef: order.userRef,
          currency: order.currency,
          finalMinor: order.finalMinor,
          receivedMinor: order.receivedMinor,
          fulfillmentStatus: order.fulfillmentStatus,
          excessResolution: order.excessResolution,
          adjustments: this.ledgerFor(orderRef),
          paymentTransactionRef: order.paymentTransactionRef,
        };
      },
      insertAdjustment: async (input: InsertAdjustmentInput): Promise<void> => {
        if (this.insertError) {
          const error = this.insertError;
          this.insertError = undefined;
          throw error;
        }
        const clash = await this.findAdjustmentByReference(input.reference);
        if (clash) throw new FakeDuplicateKeyError('externalReference_1');
        this.adjustments.push({
          reference: input.reference,
          orderRef: input.orderRef,
          amountMinor: input.amountMinor,
          currency: input.currency,
          allocation: input.allocation,
          occurredAtMs: input.occurredAtMs,
          recordedBy: input.recordedBy,
          ledger: {
            type: input.reference.type,
            allocation: input.allocation,
            amountMinor: input.amountMinor,
          },
        });
      },
      applyLedgerProjection: async (input: ApplyLedgerProjectionInput): Promise<void> => {
        const order = this.requireOrder(input.orderRef);
        order.netPrincipalMinor = input.netPrincipalMinor;
        order.settlementStatus = input.settlementStatus;
        order.excessResolution = input.excessResolution;
      },
      cancelQueuedFulfillment: async (orderRef: string): Promise<void> => {
        const order = this.requireOrder(orderRef);
        order.fulfillmentDueAtMs = null;
        // Dropping the token is what dispossesses a worker already mid-grant.
        order.fulfillmentLeaseToken = null;
      },
      armFulfillment: async (input: ArmOrderFulfillmentInput): Promise<boolean> => {
        const order = this.requireOrder(input.orderRef);
        if (order.netPrincipalMinor < order.finalMinor) return false;
        if (order.fulfillmentStatus !== 'unfulfilled' && order.fulfillmentStatus !== 'processing') {
          return false;
        }
        order.fulfillmentDueAtMs = input.dueAtMs;
        return true;
      },
      setFulfillmentStatus: async (orderRef: string, status: FulfillmentState): Promise<void> => {
        this.requireOrder(orderRef).fulfillmentStatus = status;
      },
      revokeEntitlement: async (input: EntitlementAdjustmentInput): Promise<string | null> => {
        const order = this.requireOrder(input.orderRef);
        if (!order.granted || order.revoked) return null;
        order.revoked = true;
        this.entitlementEvents.push({ kind: 'revoke', orderRef: input.orderRef });
        return 'revoke-1';
      },
      restoreEntitlement: async (input: EntitlementAdjustmentInput): Promise<string | null> => {
        const order = this.requireOrder(input.orderRef);
        if (!order.granted || !order.revoked) return null;
        order.revoked = false;
        this.entitlementEvents.push({ kind: 'restore', orderRef: input.orderRef });
        return 'restore-1';
      },
      recordExcessVerdict: async (input: RecordExcessVerdictInput): Promise<boolean> => {
        const order = this.orders.get(input.orderRef);
        if (!order) return false;
        order.excessReason = input.reason;
        return true;
      },
    };
    try {
      return await work(writers);
    } catch (error) {
      this.orders.clear();
      for (const [key, value] of orders) this.orders.set(key, value);
      this.adjustments.splice(0, this.adjustments.length, ...adjustments);
      this.entitlementEvents.splice(0, this.entitlementEvents.length, ...events);
      throw error;
    }
  }
}
