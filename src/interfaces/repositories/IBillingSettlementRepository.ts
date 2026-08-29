import type {
  AttemptEscalationReason,
  AttemptState,
} from '@/services/billing/domain/attempt-transition';
import type { ExcessResolution } from '@/services/billing/domain/excess-resolution';
import type {
  DerivedOrderCollectionState,
  OrderCollectionState,
} from '@/services/billing/domain/order-collection';
import type {
  FulfillmentReviewReason,
  FulfillmentState,
} from '@/services/billing/domain/fulfillment-decision';
import type { LedgerAdjustment, SettlementState } from '@/services/billing/domain/settlement-math';

/**
 * The settlement side of billing persistence, split from the order/checkout
 * surface so the settlement handlers depend on exactly the reads and writes
 * they use.
 *
 * Three rules shape this contract:
 *
 * - Every write lives on a transaction-bound bundle. There is no ambient
 *   session to forget to pass and no generic save/update escape hatch, so a
 *   write that is not part of a durable commit cannot be expressed.
 * - Money observation and fulfillment are separate commits with separate
 *   bundles, because an entitlement conflict must never roll back money the
 *   provider has already taken.
 * - Every queue claim hands back an opaque lease, and every write that belongs
 *   to a claim quotes it. Ownership is never inferred from a timestamp: clocks
 *   skew, and an expired lease that is still unclaimed is indistinguishable
 *   from one another worker has already taken.
 */

/** Opaque persistence handle for a billing order. */
export type OrderRef = string;
/** Opaque persistence handle for a payment attempt. */
export type AttemptRef = string;

/** Whether a fenced write found the claim it quoted still live. */
export type LeaseWriteOutcome = 'applied' | 'lease_lost';

/**
 * Proof that the holder still owns a payment attempt's reconciliation slot.
 *
 * Opaque on purpose, and obtainable only by claiming. Before this existed a
 * drain whose lease had expired could still escalate an attempt, reschedule it,
 * or write a provider verdict over the state of the worker that had reclaimed
 * it — including over a settlement that had since observed the money.
 */
export interface AttemptLease {
  readonly attemptRef: AttemptRef;
  readonly token: string;
}

export interface SettlementAttemptSnapshot {
  attemptRef: AttemptRef;
  orderRef: OrderRef;
  providerAccountId: string;
  environment: string;
  externalOrderId: string;
  paymentLinkId: string | null;
  currency: string;
  requestedAmountMinor: number;
  collectionStatus: AttemptState;
  activeForCheckout: boolean;
  expiresAtMs: number;
  /** When the attempt was confirmed terminal, or null if it never was. */
  settledAtMs: number | null;
  createdAtMs: number;
  /** Optimistic concurrency token; a transition must quote the one it read. */
  version: number;
  /**
   * The reconciliation lease this snapshot was read under, or null when the
   * snapshot was read without claiming. A settlement run must hold one before
   * it writes anything.
   */
  lease: AttemptLease | null;
}

export interface AcquireAttemptLeaseInput {
  attemptRef: AttemptRef;
  nowMs: number;
  leaseMs: number;
}

export interface RecordProviderTransactionInput {
  attemptRef: AttemptRef;
  orderRef: OrderRef;
  providerAccountId: string;
  environment: string;
  reference: string;
  amountMinor: number;
  currency: string;
  occurredAtMs: number;
  rawPayloadHash: string;
}

/**
 * The stored transaction as it exists after the upsert, which is not
 * necessarily what we just tried to write: a reference we have already seen
 * against a different attempt or amount means the provider reused an identity.
 */
export interface StoredProviderTransaction {
  attemptRef: AttemptRef;
  orderRef: OrderRef;
  currency: string;
  signedAmountMinor: number;
}

export interface ApplyAttemptTransitionInput {
  lease: AttemptLease;
  expectedVersion: number;
  expectedStatus: AttemptState;
  status: AttemptState;
  paymentLinkId: string;
  amountPaidMinor: number;
  amountRemainingMinor: number;
  activeForCheckout: boolean;
  /** Set when the attempt is being confirmed terminal now. */
  settledAtMs: number | null;
  /** Null removes the attempt from the automatic queue. */
  nextReconcileAtMs: number | null;
}

/**
 * Why a fenced attempt transition did not apply. `stale` is the ordinary
 * optimistic-concurrency loss — another writer with a fresher snapshot won and
 * left its own follow-up — while `lease_lost` means this worker no longer owns
 * the attempt at all and must write nothing more.
 */
export type AttemptWriteOutcome = 'applied' | 'stale' | 'lease_lost';

export interface OrderPaymentSummary {
  /** Sum of incoming payment transactions across every attempt on the order. */
  receivedMinor: number;
  earliestPaidAtMs: number | null;
  finalMinor: number;
  /** Every external money adjustment recorded against the order. */
  adjustments: LedgerAdjustment[];
  collectionStatus: OrderCollectionState;
  fulfillmentStatus: FulfillmentState;
}

export interface ApplyOrderCollectionInput {
  orderRef: OrderRef;
  receivedMinor: number;
  excessMinor: number;
  /**
   * What the merchant has actually kept against this order — payments plus
   * every external adjustment. Entitlement is this figure against
   * `finalAmount`, and the fulfillment claim and commit both fence on it, so it
   * is refreshed by every path that touches the order's money.
   */
  netPrincipalMinor: number;
  settlementStatus: SettlementState;
  /**
   * What has become of any overpayment, derived from the same ledger. An
   * operator's verdict is an adjustment allocated to the excess, so this is a
   * projection of the ledger rather than a flag a derivation must avoid
   * overwriting.
   */
  excessResolution: ExcessResolution;
  collectionStatus: DerivedOrderCollectionState;
  providerPaidAtMs: number | null;
  /**
   * When this observation found the order fully collected, or null when it is
   * not. Recorded once, on the first observation that completes the order: the
   * fulfillment backoff ages from it, so it must not move when a later
   * observation sees the same collected order again.
   */
  fullyCollectedAtMs: number | null;
}

export interface ArmFulfillmentInput {
  orderRef: OrderRef;
  /** When the fulfillment worker may first claim this order. */
  dueAtMs: number;
}

export interface EscalateAttemptInput {
  lease: AttemptLease;
  orderRef: OrderRef;
  reason: AttemptEscalationReason;
  /**
   * Whether the order is handed to the operator along with the attempt. An
   * order left unfrozen keeps the collection state its ledger supports, so
   * money already received stays visible while the attempt is resolved.
   */
  freezesOrder: boolean;
}

export interface RescheduleAttemptInput {
  lease: AttemptLease;
  nextReconcileAtMs: number;
  lastProviderError: string | null;
}

/**
 * Every write that belongs to the money-observation commit. Reads that the
 * commit depends on live here too, so they are taken under the same snapshot
 * as the writes that use them.
 */
export interface SettlementWriters {
  recordProviderTransaction(
    input: RecordProviderTransactionInput,
  ): Promise<StoredProviderTransaction>;
  applyAttemptTransition(input: ApplyAttemptTransitionInput): Promise<AttemptWriteOutcome>;
  sumAttemptReceivedMinor(attemptRef: AttemptRef): Promise<number>;
  summarizeOrderPayments(orderRef: OrderRef): Promise<OrderPaymentSummary | null>;
  applyOrderCollection(input: ApplyOrderCollectionInput): Promise<void>;
  /**
   * Leaves the durable paid-unfulfilled work item the second commit claims.
   * False when the order is not one automation may fulfil — it is under
   * operator review, or its net settlement does not cover what it is owed —
   * which is how a refunded order stays out of the fulfillment queue.
   */
  armFulfillment(input: ArmFulfillmentInput): Promise<boolean>;
  completeOrderIdempotency(orderRef: OrderRef): Promise<void>;
  escalateAttempt(input: EscalateAttemptInput): Promise<LeaseWriteOutcome>;
  rescheduleAttempt(input: RescheduleAttemptInput): Promise<LeaseWriteOutcome>;
  markPromotionReleaseDue(orderRef: OrderRef): Promise<void>;
}

/**
 * Proof that the holder still owns an order's fulfillment lease. Same contract
 * as {@link AttemptLease}, for the second commit.
 */
export interface FulfillmentLease {
  readonly orderRef: OrderRef;
  readonly token: string;
}

export interface FulfillmentClaim {
  orderRef: OrderRef;
  /** Quote this on every write that belongs to this claim. */
  lease: FulfillmentLease;
  userRef: string;
  planId: string;
  planName: string;
  durationUnit: 'day' | 'month';
  durationValue: number;
  /** Whether net settlement covers what the order is owed, at claim time. */
  entitled: boolean;
  /** True when an operator owns the order's collection state. */
  collectionUnderReview: boolean;
  /** The status the order had before this claim leased it. */
  fulfillmentStatus: FulfillmentState;
  providerPaidAtMs: number | null;
  /** When the order became fully collected; the retry backoff base. */
  collectedAtMs: number;
  /** How many times this order has been claimed, this claim included. */
  attemptCount: number;
}

export interface ClaimFulfillmentInput {
  orderRef: OrderRef;
  nowMs: number;
  leaseMs: number;
}

export interface GrantEntitlementInput {
  orderRef: OrderRef;
  userRef: string;
  planId: string;
  planName: string;
  durationUnit: 'day' | 'month';
  durationValue: number;
  committedAtMs: number;
  providerPaidAtMs: number | null;
}

export interface MarkFulfilledInput {
  lease: FulfillmentLease;
  fulfilledAtMs: number;
}

export interface MarkFulfillmentReviewInput {
  lease: FulfillmentLease;
  reason: FulfillmentReviewReason;
}

export interface RescheduleFulfillmentInput {
  lease: FulfillmentLease;
  dueAtMs: number;
  lastError: string | null;
}

export interface DeferFulfillmentInput {
  lease: FulfillmentLease;
  /** When the parked order should be looked at again. */
  recheckAtMs: number;
}

/**
 * Every write that belongs to the fulfillment commit. It can never touch money:
 * there is no way from here to change a transaction, an attempt or an order's
 * collected amount.
 */
export interface FulfillmentWriters {
  /**
   * Leases the order for this worker and counts the attempt. Null when the
   * order is not due or is already leased by someone else. Claiming makes no
   * policy decision: what to do with the claim is `decideFulfillment`'s call.
   */
  claim(input: ClaimFulfillmentInput): Promise<FulfillmentClaim | null>;
  grantEntitlement(input: GrantEntitlementInput): Promise<void>;
  consumePromotion(orderRef: OrderRef): Promise<void>;
  /**
   * Throws `fulfillment_lease_lost` when the claim is no longer live,
   * `fulfillment_not_entitled` when the order's net settlement stopped covering
   * what it is owed while the grant was being written, and
   * `fulfillment_state_conflict` when the order left the fulfillable state.
   * All three roll the commit back, which is the point: an entitlement granted
   * in this commit must never outlive the money that paid for it.
   */
  markFulfilled(input: MarkFulfilledInput): Promise<void>;
  markForReview(input: MarkFulfillmentReviewInput): Promise<LeaseWriteOutcome>;
  reschedule(input: RescheduleFulfillmentInput): Promise<LeaseWriteOutcome>;
  /**
   * Parks the money as awaiting manual activation and drops the lease. The
   * attempt count is reset because no fulfillment was attempted: a long parking
   * period must never spend the poison-order budget.
   */
  deferForManualActivation(input: DeferFulfillmentInput): Promise<LeaseWriteOutcome>;
  /**
   * Drops the lease and takes the order out of the automatic queue, without
   * touching its status. Used when the claim turned out to have nothing to do.
   */
  releaseLease(lease: FulfillmentLease): Promise<LeaseWriteOutcome>;
}

export type SettlementWork<T> = (tx: SettlementWriters) => Promise<T>;
export type FulfillmentWork<T> = (tx: FulfillmentWriters) => Promise<T>;

export interface ClaimDueAttemptInput {
  nowMs: number;
  /**
   * How long the claimed attempt is held out of the due selector, and how long
   * its lease token stays valid. Without it two overlapping drains poll the
   * provider for the same attempts, doubling outbound calls and racing each
   * other's transitions for no gain.
   */
  leaseMs: number;
}

export interface DueFulfillmentOrder {
  orderRef: OrderRef;
}

export interface ClaimDueFulfillmentsInput {
  nowMs: number;
  limit: number;
}

/**
 * Proof that the holder still owns a webhook inbox row. Same contract as
 * {@link AttemptLease}, for the inbox queue.
 */
export interface InboxLease {
  readonly inboxRef: string;
  readonly token: string;
}

export interface InboxClaim {
  lease: InboxLease;
  /** Null when the webhook carried no usable order code. */
  orderCode: number | null;
  attemptCount: number;
  createdAtMs: number;
}

export interface ClaimInboxEventInput {
  nowMs: number;
  leaseMs: number;
}

export interface RescheduleInboxInput {
  lease: InboxLease;
  status: 'orphaned' | 'retryable_failure' | 'dead_letter';
  nextAttemptAtMs: number;
  lastError: string | null;
}

/** Every write that belongs to one webhook inbox row's lifecycle. */
export interface InboxWriters {
  /** Null when nothing is due; leases the row it returns. */
  claim(input: ClaimInboxEventInput): Promise<InboxClaim | null>;
  markProcessed(lease: InboxLease): Promise<LeaseWriteOutcome>;
  reschedule(input: RescheduleInboxInput): Promise<LeaseWriteOutcome>;
}

export type InboxWork<T> = (tx: InboxWriters) => Promise<T>;

/** Identifies one order by its public id and the user who must own it. */
export interface OwnedOrderAttemptQuery {
  userId: string;
  publicId: string;
}

export interface IBillingSettlementRepository {
  /**
   * The order's most recent attempt, or null when the order has none. Throws
   * when the order does not exist or belongs to another user, so an unowned
   * order is indistinguishable from a missing one.
   */
  findLatestAttemptForOwnedOrder(
    query: OwnedOrderAttemptQuery,
  ): Promise<SettlementAttemptSnapshot | null>;
  /**
   * The order's active attempt when the customer is allowed to cancel it.
   * Throws when the order is missing, unowned, or past the point of no return.
   */
  findCancellableAttempt(query: OwnedOrderAttemptQuery): Promise<SettlementAttemptSnapshot>;
  loadAttemptByExternalOrderId(externalOrderId: string): Promise<SettlementAttemptSnapshot | null>;
  /**
   * Takes ownership of one attempt so an event-driven settlement — a checkout
   * verification, a webhook — writes under the same fence a drain does. Null
   * when another worker holds the lease, which the caller reports rather than
   * overrides.
   */
  acquireAttemptLease(input: AcquireAttemptLeaseInput): Promise<SettlementAttemptSnapshot | null>;
  /**
   * Takes the single oldest due attempt and leases it.
   *
   * One row at a time, inside the drain's budget loop, rather than a leased
   * batch: a batch leased up front and then abandoned when the budget ran out
   * left every unprocessed row artificially held out of the queue for the whole
   * lease, so the work the tick could not reach was invisible to the next one.
   */
  claimNextDueAttempt(input: ClaimDueAttemptInput): Promise<SettlementAttemptSnapshot | null>;
  listDueFulfillments(input: ClaimDueFulfillmentsInput): Promise<DueFulfillmentOrder[]>;
  /** Runs `work` inside one durable money-observation commit. */
  inSettlementTransaction<T>(work: SettlementWork<T>): Promise<T>;
  /** Runs `work` inside one durable fulfillment commit. */
  inFulfillmentTransaction<T>(orderRef: OrderRef, work: FulfillmentWork<T>): Promise<T>;
  /** Runs `work` inside one durable webhook inbox commit. */
  inInboxTransaction<T>(work: InboxWork<T>): Promise<T>;
}
