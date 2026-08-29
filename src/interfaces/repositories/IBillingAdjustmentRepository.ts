import type { BillingOrderView } from '@/interfaces/repositories/IBillingOrderRepository';
import type { ExcessResolution } from '@/services/billing/domain/excess-resolution';
import type { FulfillmentState } from '@/services/billing/domain/fulfillment-decision';
import type {
  LedgerAdjustment,
  MoneyAdjustmentType,
  MoneyAllocation,
  SettlementState,
} from '@/services/billing/domain/settlement-math';

/**
 * Persistence for money that moved outside the provider's payment flow —
 * refunds, chargebacks, their reversals, goodwill credits, write-offs — and for
 * the operator verdicts that close an overpayment.
 *
 * Persistence and nothing else. Deciding what an adjustment means for the
 * customer's entitlement, whether it is admissible against the ledger, and what
 * a reused external reference implies is the adjustment handler's work; this
 * port only reads and writes, and every write lives on a transaction-bound
 * bundle so a money mutation outside a durable commit cannot be expressed.
 */

/** Identifies one adjustment the way the provider namespace does. */
export interface AdjustmentReference {
  readonly type: MoneyAdjustmentType;
  readonly externalReference: string;
}

/**
 * A stored adjustment, reduced to the facts that decide whether an incoming one
 * is the same money. A retry carries all of them unchanged; a different event
 * that reuses the reference does not, and that difference is the only signal
 * there is.
 */
export interface StoredAdjustmentIdentity {
  readonly orderRef: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly allocation: MoneyAllocation;
  readonly occurredAtMs: number;
}

/** Everything the handler needs to judge one more adjustment against an order. */
export interface AdjustmentOrderSnapshot {
  readonly orderRef: string;
  readonly userRef: string;
  readonly currency: string;
  readonly finalMinor: number;
  readonly receivedMinor: number;
  readonly fulfillmentStatus: FulfillmentState;
  readonly excessResolution: ExcessResolution;
  readonly adjustments: LedgerAdjustment[];
  /**
   * The captured payment this adjustment hangs off, or null when the order has
   * never received money — in which case there is nothing to adjust.
   */
  readonly paymentTransactionRef: string | null;
}

export interface InsertAdjustmentInput {
  readonly orderRef: string;
  readonly paymentTransactionRef: string;
  readonly reference: AdjustmentReference;
  readonly amountMinor: number;
  readonly currency: string;
  readonly allocation: MoneyAllocation;
  readonly occurredAtMs: number;
  readonly recordedBy: string;
}

/** The order fields that are a projection of the money ledger. */
export interface ApplyLedgerProjectionInput {
  readonly orderRef: string;
  readonly netPrincipalMinor: number;
  readonly settlementStatus: SettlementState;
  readonly excessResolution: ExcessResolution;
}

export interface EntitlementAdjustmentInput {
  readonly orderRef: string;
  readonly userRef: string;
  readonly reference: AdjustmentReference;
  readonly reason: string;
}

export interface RecordExcessVerdictInput {
  readonly orderRef: string;
  readonly reason: string;
  readonly recordedBy: string;
  readonly resolvedAtMs: number;
}

export interface ArmOrderFulfillmentInput {
  readonly orderRef: string;
  readonly dueAtMs: number;
}

/** Every write that belongs to one adjustment's durable commit. */
export interface AdjustmentWriters {
  loadOrder(orderRef: string): Promise<AdjustmentOrderSnapshot | null>;
  /** Rejects a reused external reference with a duplicate-key error. */
  insertAdjustment(input: InsertAdjustmentInput): Promise<void>;
  applyLedgerProjection(input: ApplyLedgerProjectionInput): Promise<void>;
  /**
   * Takes the order out of the fulfillment queue and invalidates any lease on
   * it, so a worker already mid-grant loses its fence rather than completing a
   * grant for money that has gone back.
   */
  cancelQueuedFulfillment(orderRef: string): Promise<void>;
  /**
   * Queues the order for fulfillment. False when the order is not one
   * automation may fulfil — under operator review, or still not covering what
   * it is owed.
   */
  armFulfillment(input: ArmOrderFulfillmentInput): Promise<boolean>;
  setFulfillmentStatus(orderRef: string, status: FulfillmentState): Promise<void>;
  /** Null when the order produced no grant to revoke. */
  revokeEntitlement(input: EntitlementAdjustmentInput): Promise<string | null>;
  /** Null when there is no revoked grant to put back. */
  restoreEntitlement(input: EntitlementAdjustmentInput): Promise<string | null>;
  /**
   * Stores the operator's justification for disposing of an overpayment. False
   * when the overpayment was no longer theirs to dispose of, which is how two
   * operators submitting at once produce one verdict.
   */
  recordExcessVerdict(input: RecordExcessVerdictInput): Promise<boolean>;
}

export type AdjustmentWork<T> = (tx: AdjustmentWriters) => Promise<T>;

export interface IBillingAdjustmentRepository {
  /** Throws `order_not_found` rather than returning null: there is no other reading. */
  findOrderRef(publicId: string): Promise<string>;
  findAdjustmentByReference(
    reference: AdjustmentReference,
  ): Promise<StoredAdjustmentIdentity | null>;
  readOrderView(orderRef: string): Promise<BillingOrderView>;
  /** Runs `work` inside one durable adjustment commit. */
  inAdjustmentTransaction<T>(work: AdjustmentWork<T>): Promise<T>;
}
