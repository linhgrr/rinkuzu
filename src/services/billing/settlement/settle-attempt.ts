import crypto from 'crypto';
import { logger } from '@/lib/logger';
import type {
  AttemptLease,
  IBillingSettlementRepository,
  OrderRef,
  SettlementAttemptSnapshot,
  SettlementWriters,
} from '@/interfaces/repositories/IBillingSettlementRepository';
import { BillingDomainError } from '../billing-domain';
import { decideAttemptTransition, interpretProviderStatus } from '../domain/attempt-transition';
import { deriveExcessResolution } from '../domain/excess-resolution';
import { deriveOrderCollection } from '../domain/order-collection';
import { ATTEMPT_LEASE_MS, isStalled, retryFollowUp } from '../domain/schedule';
import { deriveSettlementLedger } from '../domain/settlement-math';
import type { BillingPaymentProvider, ProviderPaymentSnapshot } from '../payos-adapter';
import { fulfillOrder } from './fulfill-order';

/**
 * The one settlement implementation.
 *
 * Checkout verification, webhook processing and the reconciliation cron all
 * land here with the same attempt and the same provider snapshot. Which of them
 * triggered the settlement is telemetry: it never changes what gets written.
 *
 * Every run owns the attempt for its duration. The drain hands one in already
 * leased; the event-driven callers take the lease here. Each write quotes that
 * lease, so a run whose lease expired mid-flight writes nothing at all rather
 * than reporting a stale provider verdict over the state of the worker — or the
 * newer paid settlement — that took the attempt over.
 *
 * The write is split in two durable commits. The first records provider truth —
 * transactions, attempt state, order collection — and, if the order is now paid
 * for, leaves a leased paid-unfulfilled work item behind. The second turns that
 * work item into an entitlement. Nothing in the second commit can undo the
 * first.
 */

type SettlementOrigin = 'checkout_verify' | 'webhook' | 'reconcile_cron';

export interface SettlementDeps {
  readonly settlement: IBillingSettlementRepository;
  readonly provider: BillingPaymentProvider;
  readonly clock: () => number;
  readonly random: () => number;
  readonly autoActivationEnabled: () => boolean;
}

type SettlementOutcome =
  | 'applied'
  | 'held'
  | 'escalated'
  | 'rescheduled'
  | 'provider_unavailable'
  /** Another worker owns this attempt; this run wrote nothing. */
  | 'lease_lost';

export interface SettlementResult {
  outcome: SettlementOutcome;
  /** True when this settlement left a fulfillment work item to be claimed. */
  fulfillmentArmed: boolean;
  origin: SettlementOrigin;
}

export interface SettleAttemptCommand {
  attempt: SettlementAttemptSnapshot;
  origin: SettlementOrigin;
}

function providerOrderCode(attempt: SettlementAttemptSnapshot): number {
  const orderCode = Number(attempt.externalOrderId);
  if (!Number.isSafeInteger(orderCode)) {
    throw new BillingDomainError(
      'invalid_attempt_identity',
      'Attempt external order ID is invalid',
      500,
    );
  }
  return orderCode;
}

function violatesProviderInvariants(
  attempt: SettlementAttemptSnapshot,
  snapshot: ProviderPaymentSnapshot,
  orderCode: number,
): boolean {
  return (
    snapshot.orderCode !== orderCode ||
    snapshot.amount !== attempt.requestedAmountMinor ||
    (attempt.paymentLinkId !== null && snapshot.id !== attempt.paymentLinkId) ||
    (snapshot.currency !== undefined && snapshot.currency !== attempt.currency) ||
    snapshot.amountPaid < 0 ||
    snapshot.amountRemaining < 0
  );
}

function providerEventAtMs(transactionDateTime: string, nowMs: number): number {
  const parsed = new Date(transactionDateTime).getTime();
  return Number.isNaN(parsed) ? nowMs : parsed;
}

interface MoneyCommitResult {
  outcome: SettlementOutcome;
  fulfillmentArmed: boolean;
}

/** Every exit taken by a run that no longer owns the attempt. It writes nothing. */
const LEASE_LOST: MoneyCommitResult = { outcome: 'lease_lost', fulfillmentArmed: false };

/**
 * Recomputes the order's money state from its own ledger and writes it back.
 *
 * The ledger — payments in, adjustments either way — is the authority; the
 * fields on the order are a projection of it. Collection, net settlement,
 * settlement status and the fate of any overpayment are all derived from the
 * same read in the same commit, which is what stops them from contradicting
 * each other: `settled` cannot appear on an order that is not entitled, and a
 * closed overpayment cannot reopen on the next tick.
 */
async function refreshOrderProjection(
  tx: SettlementWriters,
  orderRef: OrderRef,
  nowMs: number,
): Promise<boolean | null> {
  const summary = await tx.summarizeOrderPayments(orderRef);
  if (summary === null) return null;
  const collection = deriveOrderCollection({
    receivedMinor: summary.receivedMinor,
    finalMinor: summary.finalMinor,
  });
  const ledger = deriveSettlementLedger({
    receivedMinor: summary.receivedMinor,
    finalMinor: summary.finalMinor,
    adjustments: summary.adjustments,
  });
  await tx.applyOrderCollection({
    orderRef,
    receivedMinor: summary.receivedMinor,
    excessMinor: collection.excessMinor,
    netPrincipalMinor: ledger.netPrincipalMinor,
    settlementStatus: ledger.settlementStatus,
    excessResolution: deriveExcessResolution({
      grossExcessMinor: ledger.grossExcessMinor,
      outstandingExcessMinor: ledger.outstandingExcessMinor,
      adjustments: summary.adjustments,
    }),
    collectionStatus: collection.status,
    providerPaidAtMs: summary.earliestPaidAtMs,
    // Only an observation that finds the order complete can date the
    // completion; the writer keeps the first such date it is given.
    fullyCollectedAtMs: collection.fullyCollected ? nowMs : null,
  });
  // Fulfillment turns on entitlement, not on collection: an order the provider
  // collected in full but whose money has since gone back is not one to grant.
  return ledger.entitled;
}

async function commitMoneyObservation(
  tx: SettlementWriters,
  attempt: SettlementAttemptSnapshot,
  lease: AttemptLease,
  snapshot: ProviderPaymentSnapshot,
  nowMs: number,
  random: () => number,
): Promise<MoneyCommitResult> {
  for (const transaction of snapshot.transactions) {
    const stored = await tx.recordProviderTransaction({
      attemptRef: attempt.attemptRef,
      orderRef: attempt.orderRef,
      providerAccountId: attempt.providerAccountId,
      environment: attempt.environment,
      reference: transaction.reference,
      amountMinor: transaction.amount,
      currency: attempt.currency,
      occurredAtMs: providerEventAtMs(transaction.transactionDateTime, nowMs),
      rawPayloadHash: crypto.createHash('sha256').update(JSON.stringify(transaction)).digest('hex'),
    });
    // The reference is the provider's identity for the money. Seeing it against
    // a different attempt, order, currency or amount means the identity was
    // reused, and guessing which one is right is not ours to do.
    if (
      stored.attemptRef !== attempt.attemptRef ||
      stored.orderRef !== attempt.orderRef ||
      stored.currency !== attempt.currency ||
      stored.signedAmountMinor !== transaction.amount
    ) {
      const escalated = await tx.escalateAttempt({
        lease,
        orderRef: attempt.orderRef,
        reason: 'provider_transaction_identity_collision',
        freezesOrder: true,
      });
      return escalated === 'lease_lost'
        ? LEASE_LOST
        : { outcome: 'escalated', fulfillmentArmed: false };
    }
  }

  const transition = decideAttemptTransition({
    current: attempt.collectionStatus,
    observed: interpretProviderStatus({
      status: snapshot.status,
      amountMinor: snapshot.amount,
      amountPaidMinor: snapshot.amountPaid,
      amountRemainingMinor: snapshot.amountRemaining,
    }),
    amountPaidMinor: snapshot.amountPaid,
    expiresAtMs: attempt.expiresAtMs,
    createdAtMs: attempt.createdAtMs,
    settledAtMs: attempt.settledAtMs,
    nowMs,
    random,
  });

  if (transition.kind === 'escalate') {
    // The transaction rows are already committed above. Refreshing the order
    // from them before the escalation is what stops observed money from
    // disappearing: an order whose attempt an operator has to resolve still
    // shows what has actually been received. Fulfillment is deliberately not
    // armed — the attempt is in dispute, and an entitlement granted off it
    // would be far harder to unwind than a delayed one.
    if (!transition.freezesOrder) await refreshOrderProjection(tx, attempt.orderRef, nowMs);
    const escalated = await tx.escalateAttempt({
      lease,
      orderRef: attempt.orderRef,
      reason: transition.reason,
      freezesOrder: transition.freezesOrder,
    });
    return escalated === 'lease_lost'
      ? LEASE_LOST
      : { outcome: 'escalated', fulfillmentArmed: false };
  }
  if (transition.kind === 'hold') return { outcome: 'held', fulfillmentArmed: false };

  let nextReconcileAtMs: number | null;
  let settledAtMs: number | null;
  if (transition.kind === 'settle') {
    nextReconcileAtMs = transition.watch === null ? null : transition.watch.atMs;
    settledAtMs = attempt.settledAtMs === null ? nowMs : null;
  } else {
    nextReconcileAtMs = transition.followUp.atMs;
    settledAtMs = null;
  }

  const applied = await tx.applyAttemptTransition({
    lease,
    expectedVersion: attempt.version,
    expectedStatus: attempt.collectionStatus,
    status: transition.state,
    paymentLinkId: snapshot.id,
    amountPaidMinor: snapshot.amountPaid,
    amountRemainingMinor: snapshot.amountRemaining,
    // Never re-open a closed attempt: a replacement may already hold the
    // unique active-for-checkout slot on this order.
    activeForCheckout: attempt.activeForCheckout && transition.kind === 'advance',
    settledAtMs,
    nextReconcileAtMs,
  });
  if (applied === 'lease_lost') return LEASE_LOST;
  // Losing the optimistic race is safe to drop: the writer that won read a
  // fresher snapshot and left its own follow-up, so the attempt is still
  // scheduled and nothing is starved.
  if (applied === 'stale') return { outcome: 'held', fulfillmentArmed: false };

  const attemptReceived = await tx.sumAttemptReceivedMinor(attempt.attemptRef);
  if (attemptReceived !== snapshot.amountPaid) {
    const escalated = await tx.escalateAttempt({
      lease,
      orderRef: attempt.orderRef,
      reason: 'provider_ledger_amount_mismatch',
      freezesOrder: true,
    });
    return escalated === 'lease_lost'
      ? LEASE_LOST
      : { outcome: 'escalated', fulfillmentArmed: false };
  }

  const entitled = await refreshOrderProjection(tx, attempt.orderRef, nowMs);
  if (entitled === null) return { outcome: 'held', fulfillmentArmed: false };
  await tx.completeOrderIdempotency(attempt.orderRef);

  if (entitled) {
    const armed = await tx.armFulfillment({ orderRef: attempt.orderRef, dueAtMs: nowMs });
    return { outcome: 'applied', fulfillmentArmed: armed };
  }
  if (transition.kind === 'settle' && transition.state !== 'paid' && snapshot.amountPaid === 0) {
    await tx.markPromotionReleaseDue(attempt.orderRef);
  }
  return { outcome: 'applied', fulfillmentArmed: false };
}

interface DeferAttemptInput {
  readonly attempt: SettlementAttemptSnapshot;
  readonly lease: AttemptLease;
  readonly nowMs: number;
  readonly random: () => number;
  /** Carried onto the attempt when the failure has a message worth keeping. */
  readonly lastProviderError: string | null;
}

/**
 * What to do with an attempt this tick could not settle: hand it to an operator
 * once it has been failing long enough to be stalled, otherwise put it back with
 * a backoff.
 *
 * Both callers reach this — the provider answering with nothing, and settlement
 * throwing before it wrote anything — and they must reach the same verdict. Two
 * copies of a retry policy is the kind of duplication that goes wrong quietly:
 * the backoff gets tuned in one and the other keeps the old curve for months.
 */
export async function deferUnsettledAttempt(
  tx: SettlementWriters,
  input: DeferAttemptInput,
): Promise<'escalated' | 'rescheduled' | 'lease_lost'> {
  const attempt = input.attempt;
  if (isStalled({ nowMs: input.nowMs, startedAtMs: attempt.createdAtMs })) {
    const escalated = await tx.escalateAttempt({
      lease: input.lease,
      orderRef: attempt.orderRef,
      reason: 'reconciliation_stalled',
      // Automation failing repeatedly says nothing about the order's own
      // ledger, so the order keeps the state its transactions support.
      freezesOrder: false,
    });
    return escalated === 'lease_lost' ? 'lease_lost' : 'escalated';
  }
  const followUp = retryFollowUp({
    nowMs: input.nowMs,
    startedAtMs: attempt.createdAtMs,
    random: input.random,
  });
  const rescheduled = await tx.rescheduleAttempt({
    lease: input.lease,
    nextReconcileAtMs: followUp.atMs,
    lastProviderError: input.lastProviderError,
  });
  return rescheduled === 'lease_lost' ? 'lease_lost' : 'rescheduled';
}

/**
 * Settles the attempt, taking the reconciliation lease first when the caller
 * did not already hold one.
 *
 * `null` means another worker owns the attempt right now. That is not a
 * failure: the owner is about to do the same work with a fresher snapshot, and
 * overriding it is exactly the stale write this fence exists to prevent.
 */
async function ownedAttempt(
  deps: SettlementDeps,
  attempt: SettlementAttemptSnapshot,
): Promise<SettlementAttemptSnapshot | null> {
  if (attempt.lease !== null) return attempt;
  return deps.settlement.acquireAttemptLease({
    attemptRef: attempt.attemptRef,
    nowMs: deps.clock(),
    leaseMs: ATTEMPT_LEASE_MS,
  });
}

export async function settleAttempt(
  deps: SettlementDeps,
  command: SettleAttemptCommand,
): Promise<SettlementResult> {
  const owned = await ownedAttempt(deps, command.attempt);
  if (owned === null || owned.lease === null) {
    return { outcome: 'lease_lost', fulfillmentArmed: false, origin: command.origin };
  }
  const lease = owned.lease;
  const orderCode = providerOrderCode(owned);
  const snapshot = await deps.provider.getPayment(orderCode);
  const nowMs = deps.clock();

  if (snapshot === null) {
    const deferral = await deps.settlement.inSettlementTransaction((tx) =>
      deferUnsettledAttempt(tx, {
        attempt: owned,
        lease,
        nowMs,
        random: deps.random,
        lastProviderError: null,
      }),
    );
    // A silent provider is reported as such rather than as a plain reschedule:
    // it is the signal that the outage is upstream, not in this order.
    const outcome: SettlementOutcome =
      deferral === 'escalated'
        ? 'escalated'
        : deferral === 'lease_lost'
          ? 'lease_lost'
          : 'provider_unavailable';
    return { outcome, fulfillmentArmed: false, origin: command.origin };
  }

  if (violatesProviderInvariants(owned, snapshot, orderCode)) {
    const escalated = await deps.settlement.inSettlementTransaction((tx) =>
      tx.escalateAttempt({
        lease,
        orderRef: owned.orderRef,
        reason: 'provider_invariant_mismatch',
        freezesOrder: true,
      }),
    );
    return {
      outcome: escalated === 'lease_lost' ? 'lease_lost' : 'escalated',
      fulfillmentArmed: false,
      origin: command.origin,
    };
  }

  const commit = await deps.settlement.inSettlementTransaction((tx) =>
    commitMoneyObservation(tx, owned, lease, snapshot, nowMs, deps.random),
  );

  if (commit.fulfillmentArmed) {
    // Fulfil inline so a customer watching the checkout page is not made to
    // wait for the next drain tick. The work item is already durable, so a
    // failure here costs latency and nothing else.
    try {
      await fulfillOrder(deps, owned.orderRef);
    } catch (error) {
      logger.warn(
        { err: error, orderRef: owned.orderRef, origin: command.origin },
        'Inline fulfillment failed; the durable work item will be retried',
      );
    }
  }

  return {
    outcome: commit.outcome,
    fulfillmentArmed: commit.fulfillmentArmed,
    origin: command.origin,
  };
}
