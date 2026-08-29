import type {
  AcquireAttemptLeaseInput,
  ApplyAttemptTransitionInput,
  ApplyOrderCollectionInput,
  ArmFulfillmentInput,
  AttemptLease,
  AttemptRef,
  AttemptWriteOutcome,
  ClaimDueAttemptInput,
  ClaimDueFulfillmentsInput,
  ClaimFulfillmentInput,
  ClaimInboxEventInput,
  DeferFulfillmentInput,
  DueFulfillmentOrder,
  EscalateAttemptInput,
  FulfillmentClaim,
  FulfillmentLease,
  FulfillmentWork,
  FulfillmentWriters,
  GrantEntitlementInput,
  IBillingSettlementRepository,
  InboxClaim,
  InboxLease,
  InboxWork,
  InboxWriters,
  LeaseWriteOutcome,
  MarkFulfilledInput,
  MarkFulfillmentReviewInput,
  OrderPaymentSummary,
  OrderRef,
  OwnedOrderAttemptQuery,
  RecordProviderTransactionInput,
  RescheduleAttemptInput,
  RescheduleFulfillmentInput,
  RescheduleInboxInput,
  SettlementAttemptSnapshot,
  SettlementWork,
  SettlementWriters,
  StoredProviderTransaction,
} from '@/interfaces/repositories/IBillingSettlementRepository';
import type { AttemptState } from '@/services/billing/domain/attempt-transition';
import type { FulfillmentState } from '@/services/billing/domain/fulfillment-decision';
import type { OrderCollectionState } from '@/services/billing/domain/order-collection';
import { BillingDomainError } from '@/services/billing/billing-domain';
import type { ExcessResolution } from '@/services/billing/domain/excess-resolution';
import type { LedgerAdjustment, SettlementState } from '@/services/billing/domain/settlement-math';

/**
 * An in-memory stand-in for the settlement persistence port.
 *
 * It is deliberately not a mock: it keeps real order, attempt, transaction,
 * adjustment, inbox and lease state, and it models the three properties the
 * handlers depend on for correctness — a transaction either applies all of its
 * writes or none of them, a lease is exclusive, and every fenced write matches
 * nothing once the lease it quotes has moved on. That makes it possible to test
 * the money and fulfillment commits, and their failure paths, without a
 * database.
 *
 * The fences here mirror the production filters rather than approximating them.
 * A double that let a stale token through would keep passing a test the real
 * writer fails, which is the only failure mode of a double that matters.
 */

export interface FakeOrder {
  orderRef: OrderRef;
  userRef: string;
  planId: string;
  planName: string;
  durationUnit: 'day' | 'month';
  durationValue: number;
  finalMinor: number;
  receivedMinor: number;
  /** Payments plus every adjustment: the figure entitlement is decided on. */
  netPrincipalMinor: number;
  settlementStatus: SettlementState;
  excessMinor: number;
  excessResolution: ExcessResolution;
  collectionStatus: OrderCollectionState;
  fulfillmentStatus: FulfillmentState;
  providerPaidAtMs: number | null;
  fulfilledAtMs: number | null;
  fullyCollectedAtMs: number | null;
  fulfillmentNextAttemptAtMs: number | null;
  fulfillmentLeaseUntilMs: number | null;
  fulfillmentLeaseToken: string | null;
  fulfillmentAttemptCount: number;
  fulfillmentLastError: string | null;
  promotionReleaseDue: boolean;
  idempotencyCompleted: boolean;
  createdAtMs: number;
}

export interface FakeAttempt extends Omit<SettlementAttemptSnapshot, 'lease'> {
  amountPaidMinor: number;
  amountRemainingMinor: number;
  nextReconcileAtMs: number | null;
  escalationReason: string | null;
  lastProviderError: string | null;
  /** When the queue claim a drain took expires; null when unclaimed. */
  reconcileLeaseUntilMs: number | null;
  /** The token that claim minted; null when the attempt is unclaimed. */
  reconcileLeaseToken: string | null;
}

export interface FakeTransaction {
  reference: string;
  attemptRef: AttemptRef;
  orderRef: OrderRef;
  currency: string;
  signedAmountMinor: number;
  occurredAtMs: number;
}

export interface FakeInboxEvent {
  inboxRef: string;
  orderCode: number | null;
  status:
    | 'verified'
    | 'processing'
    | 'processed'
    | 'orphaned'
    | 'retryable_failure'
    | 'dead_letter';
  attemptCount: number;
  nextAttemptAtMs: number;
  leaseUntilMs: number | null;
  leaseToken: string | null;
  createdAtMs: number;
  lastError: string | null;
}

export interface FakeGrant {
  orderRef: OrderRef;
  userRef: string;
  planId: string;
  committedAtMs: number;
}

export interface FakeSettlementOptions {
  /** Throws from `grantEntitlement` until the returned counter is exhausted. */
  grantFailures?: number;
  grantError?: Error;
  /** Throws from `markFulfilled`, to exercise a partially applied commit. */
  markFulfilledFailures?: number;
  /**
   * Orders whose every fulfillment write throws, modelling an item that cannot
   * even record its own failure.
   */
  poisonOrderRefs?: readonly OrderRef[];
  /**
   * Hands the order to another worker the instant a claim commits, modelling a
   * lease that expired and was reclaimed while its holder was still working.
   */
  leaseStolenAfterClaim?: boolean;
  /**
   * Hands the attempt to another worker the instant a reconciliation lease is
   * taken, modelling the same race on the settlement queue.
   */
  attemptLeaseStolenAfterClaim?: boolean;
}

export class FakeSettlementRepository implements IBillingSettlementRepository {
  readonly orders = new Map<OrderRef, FakeOrder>();
  readonly attempts = new Map<AttemptRef, FakeAttempt>();
  readonly transactions = new Map<string, FakeTransaction>();
  readonly adjustments = new Map<OrderRef, LedgerAdjustment[]>();
  readonly inbox: FakeInboxEvent[] = [];
  readonly grants: FakeGrant[] = [];
  readonly promotionsConsumed: OrderRef[] = [];
  readonly committedTransactions: string[] = [];
  /** Makes each lease token unique without reaching for a random source. */
  private leaseCounter = 0;
  private grantFailuresLeft: number;
  private markFulfilledFailuresLeft: number;
  private readonly grantError: Error;
  private readonly poisonOrderRefs: ReadonlySet<OrderRef>;
  private readonly leaseStolenAfterClaim: boolean;
  private readonly attemptLeaseStolenAfterClaim: boolean;

  constructor(options: FakeSettlementOptions = {}) {
    this.grantFailuresLeft = options.grantFailures ?? 0;
    this.markFulfilledFailuresLeft = options.markFulfilledFailures ?? 0;
    this.grantError = options.grantError ?? new Error('grant failed');
    this.poisonOrderRefs = new Set(options.poisonOrderRefs ?? []);
    this.leaseStolenAfterClaim = options.leaseStolenAfterClaim ?? false;
    this.attemptLeaseStolenAfterClaim = options.attemptLeaseStolenAfterClaim ?? false;
  }

  seedOrder(overrides: Partial<FakeOrder> & Pick<FakeOrder, 'orderRef'>): FakeOrder {
    const received = overrides.receivedMinor ?? 0;
    const order: FakeOrder = {
      userRef: 'user-1',
      planId: 'plan-premium',
      planName: 'Premium',
      durationUnit: 'month',
      durationValue: 1,
      finalMinor: 100_000,
      receivedMinor: received,
      // Defaults to the received amount so a seed that says nothing about
      // adjustments describes an order with none, exactly like the legacy
      // fallback the production claim reads.
      netPrincipalMinor: received,
      settlementStatus: 'unsettled',
      excessMinor: 0,
      excessResolution: 'none',
      collectionStatus: 'unpaid',
      fulfillmentStatus: 'unfulfilled',
      providerPaidAtMs: null,
      fulfilledAtMs: null,
      fullyCollectedAtMs: null,
      fulfillmentNextAttemptAtMs: null,
      fulfillmentLeaseUntilMs: null,
      fulfillmentLeaseToken: null,
      fulfillmentAttemptCount: 0,
      fulfillmentLastError: null,
      promotionReleaseDue: false,
      idempotencyCompleted: false,
      createdAtMs: 0,
      ...overrides,
    };
    this.orders.set(order.orderRef, order);
    return order;
  }

  seedAttempt(
    overrides: Partial<FakeAttempt> & Pick<FakeAttempt, 'attemptRef' | 'orderRef'>,
  ): FakeAttempt {
    const attempt: FakeAttempt = {
      providerAccountId: 'acct-1',
      environment: 'test',
      externalOrderId: '4242',
      paymentLinkId: 'link-1',
      currency: 'VND',
      requestedAmountMinor: 100_000,
      collectionStatus: 'pending' as AttemptState,
      activeForCheckout: true,
      expiresAtMs: Number.MAX_SAFE_INTEGER,
      settledAtMs: null,
      createdAtMs: 0,
      version: 0,
      amountPaidMinor: 0,
      amountRemainingMinor: 100_000,
      nextReconcileAtMs: 0,
      escalationReason: null,
      lastProviderError: null,
      reconcileLeaseUntilMs: null,
      reconcileLeaseToken: null,
      ...overrides,
    };
    this.attempts.set(attempt.attemptRef, attempt);
    return attempt;
  }

  seedAdjustment(orderRef: OrderRef, adjustment: LedgerAdjustment): void {
    const existing = this.adjustments.get(orderRef) ?? [];
    this.adjustments.set(orderRef, [...existing, adjustment]);
  }

  seedInboxEvent(
    overrides: Partial<FakeInboxEvent> & Pick<FakeInboxEvent, 'inboxRef'>,
  ): FakeInboxEvent {
    const event: FakeInboxEvent = {
      orderCode: 4242,
      status: 'verified',
      attemptCount: 0,
      nextAttemptAtMs: 0,
      leaseUntilMs: null,
      leaseToken: null,
      createdAtMs: 0,
      lastError: null,
      ...overrides,
    };
    this.inbox.push(event);
    return event;
  }

  private nextToken(): string {
    this.leaseCounter += 1;
    return `lease-${this.leaseCounter}`;
  }

  private snapshot(
    attempt: FakeAttempt,
    lease: AttemptLease | null = null,
  ): SettlementAttemptSnapshot {
    return {
      attemptRef: attempt.attemptRef,
      orderRef: attempt.orderRef,
      providerAccountId: attempt.providerAccountId,
      environment: attempt.environment,
      externalOrderId: attempt.externalOrderId,
      paymentLinkId: attempt.paymentLinkId,
      currency: attempt.currency,
      requestedAmountMinor: attempt.requestedAmountMinor,
      collectionStatus: attempt.collectionStatus,
      activeForCheckout: attempt.activeForCheckout,
      expiresAtMs: attempt.expiresAtMs,
      settledAtMs: attempt.settledAtMs,
      createdAtMs: attempt.createdAtMs,
      version: attempt.version,
      lease,
    };
  }

  async loadAttempt(attemptRef: AttemptRef): Promise<SettlementAttemptSnapshot | null> {
    const attempt = this.attempts.get(attemptRef);
    return attempt ? this.snapshot(attempt) : null;
  }

  async loadAttemptByExternalOrderId(
    externalOrderId: string,
  ): Promise<SettlementAttemptSnapshot | null> {
    for (const attempt of this.attempts.values()) {
      if (attempt.externalOrderId === externalOrderId) return this.snapshot(attempt);
    }
    return null;
  }

  async loadActiveAttemptForOrder(orderRef: OrderRef): Promise<SettlementAttemptSnapshot | null> {
    for (const attempt of this.attempts.values()) {
      if (attempt.orderRef === orderRef && attempt.activeForCheckout) return this.snapshot(attempt);
    }
    return null;
  }

  async findLatestAttemptForOwnedOrder(
    query: OwnedOrderAttemptQuery,
  ): Promise<SettlementAttemptSnapshot | null> {
    return this.loadActiveAttemptForOrder(query.publicId);
  }

  async findCancellableAttempt(query: OwnedOrderAttemptQuery): Promise<SettlementAttemptSnapshot> {
    const attempt = await this.loadActiveAttemptForOrder(query.publicId);
    if (!attempt) {
      throw new BillingDomainError('payment_state_conflict', 'No cancellable payment attempt');
    }
    return attempt;
  }

  /** Mints a lease on an attempt nobody else currently holds. */
  private leaseAttempt(attempt: FakeAttempt, nowMs: number, leaseMs: number): AttemptLease {
    const token = this.nextToken();
    attempt.reconcileLeaseUntilMs = nowMs + leaseMs;
    attempt.reconcileLeaseToken = token;
    if (this.attemptLeaseStolenAfterClaim) attempt.reconcileLeaseToken = this.nextToken();
    return { attemptRef: attempt.attemptRef, token };
  }

  async acquireAttemptLease(
    input: AcquireAttemptLeaseInput,
  ): Promise<SettlementAttemptSnapshot | null> {
    const attempt = this.attempts.get(input.attemptRef);
    if (!attempt) return null;
    if (attempt.reconcileLeaseUntilMs !== null && attempt.reconcileLeaseUntilMs >= input.nowMs) {
      return null;
    }
    const lease = this.leaseAttempt(attempt, input.nowMs, input.leaseMs);
    return this.snapshot(attempt, lease);
  }

  async claimNextDueAttempt(
    input: ClaimDueAttemptInput,
  ): Promise<SettlementAttemptSnapshot | null> {
    const due = [...this.attempts.values()]
      .filter(
        (attempt) =>
          attempt.collectionStatus !== 'review' &&
          attempt.nextReconcileAtMs !== null &&
          attempt.nextReconcileAtMs <= input.nowMs &&
          (attempt.reconcileLeaseUntilMs === null || attempt.reconcileLeaseUntilMs < input.nowMs),
      )
      .sort((left, right) => (left.nextReconcileAtMs ?? 0) - (right.nextReconcileAtMs ?? 0))[0];
    if (!due) return null;
    const lease = this.leaseAttempt(due, input.nowMs, input.leaseMs);
    return this.snapshot(due, lease);
  }

  async listDueFulfillments(input: ClaimDueFulfillmentsInput): Promise<DueFulfillmentOrder[]> {
    return [...this.orders.values()]
      .filter(
        (order) =>
          order.fulfillmentNextAttemptAtMs !== null &&
          order.fulfillmentNextAttemptAtMs <= input.nowMs &&
          (order.fulfillmentLeaseUntilMs === null || order.fulfillmentLeaseUntilMs < input.nowMs),
      )
      .sort(
        (left, right) =>
          (left.fulfillmentNextAttemptAtMs ?? 0) - (right.fulfillmentNextAttemptAtMs ?? 0),
      )
      .slice(0, input.limit)
      .map((order) => ({ orderRef: order.orderRef }));
  }

  /**
   * Runs `work` against a copy of the world and keeps the result only if it
   * returns. A throw leaves the committed state untouched, which is what makes
   * "the money commit survived a failed fulfillment" testable.
   */
  private async atomically<T>(work: () => Promise<T>): Promise<T> {
    const orders = new Map([...this.orders].map(([key, value]) => [key, { ...value }]));
    const attempts = new Map([...this.attempts].map(([key, value]) => [key, { ...value }]));
    const transactions = new Map([...this.transactions].map(([key, value]) => [key, { ...value }]));
    const adjustments = new Map([...this.adjustments].map(([key, value]) => [key, [...value]]));
    const inbox = this.inbox.map((event) => ({ ...event }));
    const grants = [...this.grants];
    const promotions = [...this.promotionsConsumed];
    try {
      return await work();
    } catch (error) {
      this.orders.clear();
      for (const [key, value] of orders) this.orders.set(key, value);
      this.attempts.clear();
      for (const [key, value] of attempts) this.attempts.set(key, value);
      this.transactions.clear();
      for (const [key, value] of transactions) this.transactions.set(key, value);
      this.adjustments.clear();
      for (const [key, value] of adjustments) this.adjustments.set(key, value);
      this.inbox.splice(0, this.inbox.length, ...inbox);
      this.grants.splice(0, this.grants.length, ...grants);
      this.promotionsConsumed.splice(0, this.promotionsConsumed.length, ...promotions);
      throw error;
    }
  }

  private requireOrder(orderRef: OrderRef): FakeOrder {
    const order = this.orders.get(orderRef);
    if (!order) throw new Error(`Unknown order ${orderRef}`);
    return order;
  }

  /**
   * The order a lease still owns, or null once someone else has claimed it.
   * Modelling the fence here is the point of the double: a write from a worker
   * whose lease has moved on must be a no-op, not a silent overwrite.
   */
  private ownedOrder(lease: FulfillmentLease): FakeOrder | null {
    const order = this.requireOrder(lease.orderRef);
    return order.fulfillmentLeaseToken === lease.token ? order : null;
  }

  private dropLease(order: FakeOrder): void {
    order.fulfillmentLeaseUntilMs = null;
    order.fulfillmentLeaseToken = null;
  }

  private requireAttempt(attemptRef: AttemptRef): FakeAttempt {
    const attempt = this.attempts.get(attemptRef);
    if (!attempt) throw new Error(`Unknown attempt ${attemptRef}`);
    return attempt;
  }

  /** The attempt a reconciliation lease still owns, or null once it moved on. */
  private ownedAttempt(lease: AttemptLease): FakeAttempt | null {
    const attempt = this.requireAttempt(lease.attemptRef);
    return attempt.reconcileLeaseToken === lease.token ? attempt : null;
  }

  private dropAttemptLease(attempt: FakeAttempt): void {
    attempt.reconcileLeaseUntilMs = null;
    attempt.reconcileLeaseToken = null;
  }

  private orderAdjustments(orderRef: OrderRef): LedgerAdjustment[] {
    return [...(this.adjustments.get(orderRef) ?? [])];
  }

  inSettlementTransaction<T>(work: SettlementWork<T>): Promise<T> {
    return this.atomically(async () => {
      this.committedTransactions.push('settlement');
      const writers: SettlementWriters = {
        recordProviderTransaction: async (
          input: RecordProviderTransactionInput,
        ): Promise<StoredProviderTransaction> => {
          const existing = this.transactions.get(input.reference);
          if (existing) return existing;
          const stored: FakeTransaction = {
            reference: input.reference,
            attemptRef: input.attemptRef,
            orderRef: input.orderRef,
            currency: input.currency,
            signedAmountMinor: input.amountMinor,
            occurredAtMs: input.occurredAtMs,
          };
          this.transactions.set(input.reference, stored);
          return stored;
        },
        applyAttemptTransition: async (
          input: ApplyAttemptTransitionInput,
        ): Promise<AttemptWriteOutcome> => {
          const attempt = this.ownedAttempt(input.lease);
          if (attempt === null) return 'lease_lost';
          if (attempt.version !== input.expectedVersion) return 'stale';
          if (attempt.collectionStatus !== input.expectedStatus) return 'stale';
          attempt.collectionStatus = input.status;
          attempt.paymentLinkId = input.paymentLinkId;
          attempt.amountPaidMinor = input.amountPaidMinor;
          attempt.amountRemainingMinor = input.amountRemainingMinor;
          attempt.activeForCheckout = input.activeForCheckout;
          attempt.nextReconcileAtMs = input.nextReconcileAtMs;
          this.dropAttemptLease(attempt);
          if (input.settledAtMs !== null) attempt.settledAtMs = input.settledAtMs;
          attempt.version += 1;
          return 'applied';
        },
        sumAttemptReceivedMinor: async (attemptRef: AttemptRef): Promise<number> =>
          [...this.transactions.values()]
            .filter((transaction) => transaction.attemptRef === attemptRef)
            .reduce((total, transaction) => total + transaction.signedAmountMinor, 0),
        summarizeOrderPayments: async (orderRef: OrderRef): Promise<OrderPaymentSummary | null> => {
          const order = this.orders.get(orderRef);
          if (!order) return null;
          const rows = [...this.transactions.values()].filter(
            (transaction) => transaction.orderRef === orderRef,
          );
          return {
            receivedMinor: rows.reduce((total, row) => total + row.signedAmountMinor, 0),
            earliestPaidAtMs: rows.length ? Math.min(...rows.map((row) => row.occurredAtMs)) : null,
            finalMinor: order.finalMinor,
            adjustments: this.orderAdjustments(orderRef),
            collectionStatus: order.collectionStatus,
            fulfillmentStatus: order.fulfillmentStatus,
          };
        },
        applyOrderCollection: async (input: ApplyOrderCollectionInput): Promise<void> => {
          const order = this.requireOrder(input.orderRef);
          order.receivedMinor = input.receivedMinor;
          order.netPrincipalMinor = input.netPrincipalMinor;
          order.excessMinor = input.excessMinor;
          // Both are projections of the same ledger read, written together and
          // without a filter: nothing they could contradict is stored anywhere
          // else, so there is no terminal state to protect them from.
          order.settlementStatus = input.settlementStatus;
          order.excessResolution = input.excessResolution;
          order.providerPaidAtMs = input.providerPaidAtMs;
          // Recorded once, on the observation that completes the order.
          if (input.fullyCollectedAtMs !== null && order.fullyCollectedAtMs === null) {
            order.fullyCollectedAtMs = input.fullyCollectedAtMs;
          }
          // Review is operator-owned and is never washed out by a later
          // automatic observation.
          if (order.collectionStatus !== 'review') order.collectionStatus = input.collectionStatus;
        },
        armFulfillment: async (input: ArmFulfillmentInput): Promise<boolean> => {
          const order = this.requireOrder(input.orderRef);
          if (
            order.fulfillmentStatus !== 'unfulfilled' &&
            order.fulfillmentStatus !== 'processing'
          ) {
            return false;
          }
          if (order.collectionStatus === 'review') return false;
          // The production filter carries the entitlement predicate, so an
          // order whose money went back is never armed in the first place.
          if (order.netPrincipalMinor < order.finalMinor) return false;
          order.fulfillmentNextAttemptAtMs = input.dueAtMs;
          order.fulfillmentLeaseUntilMs = null;
          order.fulfillmentLeaseToken = null;
          return true;
        },
        completeOrderIdempotency: async (orderRef: OrderRef): Promise<void> => {
          this.requireOrder(orderRef).idempotencyCompleted = true;
        },
        escalateAttempt: async (input: EscalateAttemptInput): Promise<LeaseWriteOutcome> => {
          const attempt = this.ownedAttempt(input.lease);
          if (attempt === null) return 'lease_lost';
          attempt.collectionStatus = 'review';
          attempt.escalationReason = input.reason;
          attempt.nextReconcileAtMs = null;
          this.dropAttemptLease(attempt);
          if (input.freezesOrder) this.requireOrder(input.orderRef).collectionStatus = 'review';
          return 'applied';
        },
        rescheduleAttempt: async (input: RescheduleAttemptInput): Promise<LeaseWriteOutcome> => {
          const attempt = this.ownedAttempt(input.lease);
          if (attempt === null) return 'lease_lost';
          attempt.nextReconcileAtMs = input.nextReconcileAtMs;
          attempt.lastProviderError = input.lastProviderError;
          this.dropAttemptLease(attempt);
          return 'applied';
        },
        markPromotionReleaseDue: async (orderRef: OrderRef): Promise<void> => {
          this.requireOrder(orderRef).promotionReleaseDue = true;
        },
      };
      return work(writers);
    });
  }

  inFulfillmentTransaction<T>(orderRef: OrderRef, work: FulfillmentWork<T>): Promise<T> {
    return this.atomically(async () => {
      if (this.poisonOrderRefs.has(orderRef)) throw new Error(`order ${orderRef} is unwritable`);
      this.committedTransactions.push(`fulfillment:${orderRef}`);
      const writers: FulfillmentWriters = {
        claim: async (input: ClaimFulfillmentInput): Promise<FulfillmentClaim | null> => {
          const order = this.requireOrder(input.orderRef);
          if (order.fulfillmentNextAttemptAtMs === null) return null;
          if (order.fulfillmentNextAttemptAtMs > input.nowMs) return null;
          if (
            order.fulfillmentLeaseUntilMs !== null &&
            order.fulfillmentLeaseUntilMs >= input.nowMs
          ) {
            return null;
          }
          const token = this.nextToken();
          order.fulfillmentLeaseUntilMs = input.nowMs + input.leaseMs;
          order.fulfillmentLeaseToken = token;
          order.fulfillmentAttemptCount += 1;
          if (this.leaseStolenAfterClaim) order.fulfillmentLeaseToken = this.nextToken();
          return {
            orderRef: order.orderRef,
            lease: { orderRef: order.orderRef, token },
            userRef: order.userRef,
            planId: order.planId,
            planName: order.planName,
            durationUnit: order.durationUnit,
            durationValue: order.durationValue,
            // Read off the claim itself, exactly as the production writer does.
            entitled: order.netPrincipalMinor >= order.finalMinor,
            collectionUnderReview: order.collectionStatus === 'review',
            fulfillmentStatus: order.fulfillmentStatus,
            providerPaidAtMs: order.providerPaidAtMs,
            collectedAtMs: order.fullyCollectedAtMs ?? order.createdAtMs,
            attemptCount: order.fulfillmentAttemptCount,
          };
        },
        grantEntitlement: async (input: GrantEntitlementInput): Promise<void> => {
          if (this.grantFailuresLeft > 0) {
            this.grantFailuresLeft -= 1;
            throw this.grantError;
          }
          const existing = this.grants.find((grant) => grant.orderRef === input.orderRef);
          if (existing) return;
          this.grants.push({
            orderRef: input.orderRef,
            userRef: input.userRef,
            planId: input.planId,
            committedAtMs: input.committedAtMs,
          });
        },
        consumePromotion: async (orderRef: OrderRef): Promise<void> => {
          this.promotionsConsumed.push(orderRef);
        },
        markFulfilled: async (input: MarkFulfilledInput): Promise<void> => {
          if (this.markFulfilledFailuresLeft > 0) {
            this.markFulfilledFailuresLeft -= 1;
            throw new Error('mark fulfilled failed');
          }
          const order = this.requireOrder(input.lease.orderRef);
          if (order.fulfillmentLeaseToken !== input.lease.token) {
            throw new BillingDomainError(
              'fulfillment_lease_lost',
              'Fulfillment lease was taken by another worker',
              409,
            );
          }
          // Money that went back while the grant was being written loses, and
          // it loses here rather than by whichever commit happened to be
          // quicker: this throw rolls the grant back with it.
          if (order.netPrincipalMinor < order.finalMinor) {
            throw new BillingDomainError(
              'fulfillment_not_entitled',
              'The order stopped covering what it is owed during fulfillment',
              409,
            );
          }
          if (
            order.collectionStatus === 'review' ||
            (order.fulfillmentStatus !== 'unfulfilled' && order.fulfillmentStatus !== 'processing')
          ) {
            throw new BillingDomainError(
              'fulfillment_state_conflict',
              'Order left the fulfillable state during fulfillment',
              409,
            );
          }
          order.fulfillmentStatus = 'fulfilled';
          order.fulfilledAtMs = input.fulfilledAtMs;
          order.fulfillmentNextAttemptAtMs = null;
          this.dropLease(order);
          order.fulfillmentLastError = null;
        },
        markForReview: async (input: MarkFulfillmentReviewInput): Promise<LeaseWriteOutcome> => {
          const order = this.ownedOrder(input.lease);
          if (order === null) return 'lease_lost';
          order.fulfillmentStatus = 'review';
          order.fulfillmentLastError = input.reason;
          order.fulfillmentNextAttemptAtMs = null;
          this.dropLease(order);
          return 'applied';
        },
        reschedule: async (input: RescheduleFulfillmentInput): Promise<LeaseWriteOutcome> => {
          const order = this.ownedOrder(input.lease);
          if (order === null) return 'lease_lost';
          order.fulfillmentNextAttemptAtMs = input.dueAtMs;
          this.dropLease(order);
          if (input.lastError !== null) order.fulfillmentLastError = input.lastError;
          return 'applied';
        },
        deferForManualActivation: async (
          input: DeferFulfillmentInput,
        ): Promise<LeaseWriteOutcome> => {
          const order = this.ownedOrder(input.lease);
          if (order === null) return 'lease_lost';
          if (order.fulfillmentStatus === 'unfulfilled') order.fulfillmentStatus = 'processing';
          order.fulfillmentNextAttemptAtMs = input.recheckAtMs;
          order.fulfillmentAttemptCount = 0;
          this.dropLease(order);
          return 'applied';
        },
        releaseLease: async (lease: FulfillmentLease): Promise<LeaseWriteOutcome> => {
          const order = this.ownedOrder(lease);
          if (order === null) return 'lease_lost';
          order.fulfillmentNextAttemptAtMs = null;
          this.dropLease(order);
          return 'applied';
        },
      };
      return work(writers);
    });
  }

  inInboxTransaction<T>(work: InboxWork<T>): Promise<T> {
    return this.atomically(async () => {
      this.committedTransactions.push('inbox');
      const ownedEvent = (lease: InboxLease): FakeInboxEvent | null => {
        const event = this.inbox.find((candidate) => candidate.inboxRef === lease.inboxRef);
        if (!event) return null;
        // The production filter matches on the token *and* on `processing`, so
        // a row someone else has already resolved is not writable either.
        if (event.leaseToken !== lease.token || event.status !== 'processing') return null;
        return event;
      };
      const writers: InboxWriters = {
        claim: async (input: ClaimInboxEventInput): Promise<InboxClaim | null> => {
          const event = this.inbox
            .filter(
              (candidate) =>
                ['verified', 'processing', 'retryable_failure', 'orphaned'].includes(
                  candidate.status,
                ) &&
                candidate.nextAttemptAtMs <= input.nowMs &&
                (candidate.leaseUntilMs === null || candidate.leaseUntilMs < input.nowMs),
            )
            .sort((left, right) => left.nextAttemptAtMs - right.nextAttemptAtMs)[0];
          if (!event) return null;
          const token = this.nextToken();
          event.status = 'processing';
          event.leaseUntilMs = input.nowMs + input.leaseMs;
          event.leaseToken = token;
          event.attemptCount += 1;
          if (this.leaseStolenAfterClaim) event.leaseToken = this.nextToken();
          return {
            lease: { inboxRef: event.inboxRef, token },
            orderCode: event.orderCode,
            attemptCount: event.attemptCount,
            createdAtMs: event.createdAtMs,
          };
        },
        markProcessed: async (lease: InboxLease): Promise<LeaseWriteOutcome> => {
          const event = ownedEvent(lease);
          if (event === null) return 'lease_lost';
          event.status = 'processed';
          event.leaseUntilMs = null;
          event.leaseToken = null;
          return 'applied';
        },
        reschedule: async (input: RescheduleInboxInput): Promise<LeaseWriteOutcome> => {
          const event = ownedEvent(input.lease);
          if (event === null) return 'lease_lost';
          event.status = input.status;
          event.nextAttemptAtMs = input.nextAttemptAtMs;
          event.leaseUntilMs = null;
          event.leaseToken = null;
          if (input.lastError !== null) event.lastError = input.lastError;
          return 'applied';
        },
      };
      return work(writers);
    });
  }
}
