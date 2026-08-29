import type {
  IBillingSettlementRepository,
  OrderRef,
} from '@/interfaces/repositories/IBillingSettlementRepository';
import { BillingDomainError } from '../billing-domain';
import { classifyFulfillmentFailure, decideFulfillment } from '../domain/fulfillment-decision';
import { FULFILLMENT_LEASE_MS, manualActivationFollowUp } from '../domain/schedule';

/**
 * The second of the two durable commits: turn money that is already recorded
 * into an entitlement.
 *
 * The money is never at risk here. A claim, a grant and a failure verdict are
 * three separate commits, so a crash anywhere leaves the order exactly where
 * the last commit put it, and the attempt count that eventually stops a poison
 * order from retrying forever survives the crash too.
 */

export interface FulfillmentDeps {
  readonly settlement: IBillingSettlementRepository;
  readonly clock: () => number;
  readonly random: () => number;
  readonly autoActivationEnabled: () => boolean;
}

type FulfillmentOutcome =
  | 'granted'
  | 'deferred'
  | 'review'
  | 'rescheduled'
  | 'skipped'
  | 'not_claimable'
  /** The lease expired mid-flight and another worker took the order over. */
  | 'lease_lost';

export interface FulfillOrderResult {
  outcome: FulfillmentOutcome;
  /** Why the order was skipped, deferred or sent to review; null otherwise. */
  reason: string | null;
}

function domainErrorCode(error: unknown): string | null {
  return error instanceof BillingDomainError ? error.code : null;
}

/**
 * Every exit taken by a worker that no longer owns the order. It writes
 * nothing: the worker holding the lease is the only one entitled to say what
 * happens to this order next.
 */
const LEASE_LOST: FulfillOrderResult = { outcome: 'lease_lost', reason: null };

export async function fulfillOrder(
  deps: FulfillmentDeps,
  orderRef: OrderRef,
): Promise<FulfillOrderResult> {
  const nowMs = deps.clock();
  const claim = await deps.settlement.inFulfillmentTransaction(orderRef, (tx) =>
    tx.claim({ orderRef, nowMs, leaseMs: FULFILLMENT_LEASE_MS }),
  );
  if (!claim) return { outcome: 'not_claimable', reason: null };

  const decision = decideFulfillment({
    entitled: claim.entitled,
    collectionUnderReview: claim.collectionUnderReview,
    fulfillment: claim.fulfillmentStatus,
    autoActivationEnabled: deps.autoActivationEnabled(),
  });

  if (decision.kind === 'skip') {
    const released = await deps.settlement.inFulfillmentTransaction(orderRef, (tx) =>
      tx.releaseLease(claim.lease),
    );
    if (released === 'lease_lost') return LEASE_LOST;
    return { outcome: 'skipped', reason: decision.reason };
  }

  if (decision.kind === 'defer') {
    const deferred = await deps.settlement.inFulfillmentTransaction(orderRef, (tx) =>
      tx.deferForManualActivation({
        lease: claim.lease,
        recheckAtMs: manualActivationFollowUp(nowMs, deps.random).atMs,
      }),
    );
    if (deferred === 'lease_lost') return LEASE_LOST;
    return { outcome: 'deferred', reason: 'auto_activation_disabled' };
  }

  try {
    await deps.settlement.inFulfillmentTransaction(orderRef, async (tx) => {
      await tx.grantEntitlement({
        orderRef,
        userRef: claim.userRef,
        planId: claim.planId,
        planName: claim.planName,
        durationUnit: claim.durationUnit,
        durationValue: claim.durationValue,
        committedAtMs: nowMs,
        providerPaidAtMs: claim.providerPaidAtMs,
      });
      await tx.consumePromotion(orderRef);
      await tx.markFulfilled({ lease: claim.lease, fulfilledAtMs: nowMs });
    });
    return { outcome: 'granted', reason: null };
  } catch (error) {
    // The grant transaction rolled itself back, so nothing was granted and the
    // money is untouched. The verdict is its own commit for exactly that
    // reason: an expected entitlement conflict must be able to record "needs an
    // operator" without ever reopening the payment.
    const code = domainErrorCode(error);
    // The order belongs to whoever holds the lease now. Recording a verdict
    // against it would overwrite the newer worker's state with a report about
    // work this one is no longer responsible for.
    if (code === 'fulfillment_lease_lost') return LEASE_LOST;
    // Money went back while the grant was being written, and the commit rolled
    // it back. There is nothing to retry and nothing for an operator to fix in
    // the grant, so the work item is dropped: the order is simply not one to
    // fulfil any more, and the adjustment that made it so is the record of why.
    if (code === 'fulfillment_not_entitled') {
      const released = await deps.settlement.inFulfillmentTransaction(orderRef, (tx) =>
        tx.releaseLease(claim.lease),
      );
      if (released === 'lease_lost') return LEASE_LOST;
      return { outcome: 'skipped', reason: 'not_entitled' };
    }
    const outcome = classifyFulfillmentFailure({
      code,
      attemptCount: claim.attemptCount,
      nowMs,
      collectedAtMs: claim.collectedAtMs,
      random: deps.random,
    });
    if (outcome.kind === 'review') {
      const reviewed = await deps.settlement.inFulfillmentTransaction(orderRef, (tx) =>
        tx.markForReview({ lease: claim.lease, reason: outcome.reason }),
      );
      if (reviewed === 'lease_lost') return LEASE_LOST;
      return { outcome: 'review', reason: outcome.reason };
    }
    const rescheduled = await deps.settlement.inFulfillmentTransaction(orderRef, (tx) =>
      tx.reschedule({
        lease: claim.lease,
        dueAtMs: outcome.followUp.atMs,
        lastError: error instanceof Error ? error.message.slice(0, 1_000) : 'Fulfillment failed',
      }),
    );
    if (rescheduled === 'lease_lost') return LEASE_LOST;
    return { outcome: 'rescheduled', reason: null };
  }
}
