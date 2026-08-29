import type { BillingOrderView } from '@/interfaces/repositories/IBillingOrderRepository';
import type {
  AdjustmentOrderSnapshot,
  AdjustmentReference,
  AdjustmentWriters,
  IBillingAdjustmentRepository,
  StoredAdjustmentIdentity,
} from '@/interfaces/repositories/IBillingAdjustmentRepository';
import { BillingDomainError } from '../billing-domain';
import {
  canResolveExcess,
  deriveExcessResolution,
  excessAdjustmentTypeForCommand,
  type ExcessResolutionCommand,
} from '../domain/excess-resolution';
import {
  admitAdjustment,
  deriveSettlementLedger,
  type LedgerAdjustment,
  type MoneyAdjustmentType,
  type MoneyAllocation,
  type SettlementLedger,
} from '../domain/settlement-math';

/**
 * Accounting that happens outside the payment flow.
 *
 * Two rules hold everything here together. Money is judged by the whole ledger,
 * never by the event in hand: a second refund that individually looks fine but
 * would return more than was ever captured is refused, and entitlement follows
 * `netPrincipal >= finalAmount` rather than the type of the latest event, so a
 * reversed chargeback gives Premium back instead of revoking it forever.
 *
 * The second rule is that an adjustment owns the fulfillment queue as well as
 * the grant. Money that leaves before fulfillment ever ran used to change
 * nothing — the order was still `paid`, still queued, and the worker granted
 * Premium for a refunded order minutes later. Cancelling the queued work is
 * therefore part of the same commit that records the money, and arming it is
 * part of the commit that records a credit making an order whole.
 */

export interface AdjustmentDeps {
  readonly adjustments: IBillingAdjustmentRepository;
  readonly clock: () => number;
  /** Whether automation may claw an entitlement back on its own. */
  readonly autoRevocationEnabled: () => boolean;
}

export interface RecordExternalMoneyAdjustmentCommand {
  readonly recordedBy: string;
  /** The order's public UUID; admins never see persistence identifiers. */
  readonly orderId: string;
  readonly type: MoneyAdjustmentType;
  readonly externalReference: string;
  readonly amount: number;
  readonly currency: string;
  readonly allocation: MoneyAllocation;
  readonly occurredAt: string;
}

export interface ResolveOrderExcessCommand {
  readonly recordedBy: string;
  readonly orderId: string;
  readonly command: ExcessResolutionCommand;
  /** Why the operator chose this disposal; kept on the order's audit trail. */
  readonly reason: string;
}

/** The facts that decide whether two records of one reference are the same money. */
interface ReplayCandidate {
  readonly orderRef: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly allocation: MoneyAllocation;
  readonly occurredAtMs: number;
}

const DUPLICATE_KEY = 11000;

function isDuplicateKey(error: unknown): boolean {
  return (error as { code?: number }).code === DUPLICATE_KEY;
}

/**
 * Whether a stored adjustment is the same money as the one being recorded.
 *
 * Identity is the whole of it — order, amount, currency, allocation and the
 * instant it happened. A retry carries all five unchanged; a different event
 * that reuses the reference does not.
 */
function isSameAdjustment(existing: StoredAdjustmentIdentity, candidate: ReplayCandidate): boolean {
  return (
    existing.orderRef === candidate.orderRef &&
    existing.amountMinor === candidate.amountMinor &&
    existing.currency === candidate.currency &&
    existing.allocation === candidate.allocation &&
    existing.occurredAtMs === candidate.occurredAtMs
  );
}

/**
 * Decides what an already-used external reference means.
 *
 * Three outcomes, and only the first is a success: an identical replay returns
 * the order it already adjusted, the same reference against a *different* order
 * is a mis-keyed entry that must not report an untouched order back as if it
 * had been adjusted, and the same reference with different money is a distinct
 * event that needs its own reference.
 *
 * `null` means the reference is not recorded at all — which, on the duplicate-
 * key path below, is the tell that the collision came from some other unique
 * index and must not be swallowed as a replay.
 */
async function discriminateReplay(
  deps: AdjustmentDeps,
  reference: AdjustmentReference,
  candidate: ReplayCandidate,
): Promise<BillingOrderView | null> {
  const existing = await deps.adjustments.findAdjustmentByReference(reference);
  if (!existing) return null;
  if (isSameAdjustment(existing, candidate)) {
    return deps.adjustments.readOrderView(candidate.orderRef);
  }
  throw new BillingDomainError(
    'adjustment_reference_conflict',
    existing.orderRef === candidate.orderRef
      ? 'This external reference is already recorded with different details'
      : 'This external reference is already recorded against another order',
    409,
  );
}

/**
 * Brings the fulfillment queue and the entitlement back in line with the money.
 *
 * `review` is reserved for the one case where the two genuinely disagree and no
 * automation may close the gap: money has left an order that was fulfilled, but
 * automatic revocation is switched off, so a person has to act. Everywhere else
 * the order is either dequeued, queued, revoked or fulfilled, and none of those
 * needs an operator.
 */
async function applyEntitlementEffects(
  tx: AdjustmentWriters,
  deps: AdjustmentDeps,
  order: AdjustmentOrderSnapshot,
  ledger: SettlementLedger,
  reference: AdjustmentReference,
): Promise<void> {
  const identity = {
    orderRef: order.orderRef,
    userRef: order.userRef,
    reference,
  };

  if (!ledger.entitled) {
    // First, and unconditionally: whatever else is true, this order must not be
    // granted after this commit. It also invalidates the lease of a worker that
    // is granting it right now, which rolls that grant back.
    await tx.cancelQueuedFulfillment(order.orderRef);
    if (order.fulfillmentStatus !== 'fulfilled') return;
    if (!deps.autoRevocationEnabled()) {
      await tx.setFulfillmentStatus(order.orderRef, 'review');
      return;
    }
    await tx.revokeEntitlement({
      ...identity,
      reason: `External ${reference.type} recorded by admin`,
    });
    await tx.setFulfillmentStatus(order.orderRef, 'revoked');
    return;
  }

  if (order.fulfillmentStatus === 'fulfilled') return;
  // An order an operator took over stays theirs; putting it back in the queue
  // would undo the decision they are in the middle of making.
  if (order.fulfillmentStatus === 'review') return;

  if (order.fulfillmentStatus === 'revoked') {
    if (!deps.autoRevocationEnabled()) {
      await tx.setFulfillmentStatus(order.orderRef, 'review');
      return;
    }
    const restored = await tx.restoreEntitlement({
      ...identity,
      reason: `Entitlement restored after ${reference.type}`,
    });
    if (restored !== null) {
      await tx.setFulfillmentStatus(order.orderRef, 'fulfilled');
      return;
    }
    // Revoked without a grant behind it: there is nothing to put back, so the
    // order is queued for a first fulfillment like any other entitled order.
    await tx.setFulfillmentStatus(order.orderRef, 'unfulfilled');
  }

  // Unfulfilled, processing, or revoked-without-a-grant. The money now covers
  // what the order is owed, so it earns a durable work item — which is how a
  // merchant credit against an underpaid order produces Premium instead of
  // trying to restore a grant that never existed.
  await tx.armFulfillment({ orderRef: order.orderRef, dueAtMs: deps.clock() });
}

/**
 * Decides the money to record against the order as it stands inside the commit.
 * A caller that already knows the amount ignores both arguments; an operator's
 * overpayment verdict needs the outstanding surplus, which only exists here,
 * and refuses the whole commit by throwing.
 */
type AdjustmentCandidateFactory = (
  order: AdjustmentOrderSnapshot,
  ledger: SettlementLedger,
) => LedgerAdjustment;

/** Extra work that belongs to the same commit, once the ledger is written. */
type AdjustmentFollowUp = (tx: AdjustmentWriters, order: AdjustmentOrderSnapshot) => Promise<void>;

interface CommitAdjustmentInput {
  readonly orderRef: string;
  readonly reference: AdjustmentReference;
  readonly candidate: AdjustmentCandidateFactory;
  readonly currency: string;
  readonly occurredAtMs: number;
  readonly recordedBy: string;
  readonly afterProjection?: AdjustmentFollowUp;
}

/**
 * The one durable commit every adjustment goes through, operator verdicts
 * included. Admissibility, the ledger projection and the entitlement effects
 * are written once here rather than once per entry point, so an overpayment
 * disposed of by an operator and a refund recorded from a bank statement cannot
 * leave the order in two different shapes.
 */
async function commitAdjustment(deps: AdjustmentDeps, input: CommitAdjustmentInput): Promise<void> {
  await deps.adjustments.inAdjustmentTransaction(async (tx) => {
    const order = await tx.loadOrder(input.orderRef);
    if (!order) throw new BillingDomainError('order_not_found', 'Order not found', 404);
    if (order.currency !== input.currency) {
      throw new BillingDomainError('currency_mismatch', 'Currency does not match order', 400);
    }
    if (order.paymentTransactionRef === null) {
      throw new BillingDomainError('payment_not_found', 'No captured payment was found', 409);
    }

    const before = {
      receivedMinor: order.receivedMinor,
      finalMinor: order.finalMinor,
      adjustments: order.adjustments,
    };
    const candidate = input.candidate(order, deriveSettlementLedger(before));

    const admissibility = admitAdjustment({ ledger: before, candidate });
    if (!admissibility.admissible) {
      throw new BillingDomainError(admissibility.code, admissibility.message, 409);
    }

    await tx.insertAdjustment({
      orderRef: order.orderRef,
      paymentTransactionRef: order.paymentTransactionRef,
      reference: input.reference,
      amountMinor: candidate.amountMinor,
      currency: input.currency,
      allocation: candidate.allocation,
      occurredAtMs: input.occurredAtMs,
      recordedBy: input.recordedBy,
    });

    const after = deriveSettlementLedger({
      ...before,
      adjustments: [...before.adjustments, candidate],
    });
    // The projection lands before the entitlement effects because arming a
    // fulfillment work item is fenced on the very figure written here.
    await tx.applyLedgerProjection({
      orderRef: order.orderRef,
      netPrincipalMinor: after.netPrincipalMinor,
      settlementStatus: after.settlementStatus,
      excessResolution: deriveExcessResolution({
        grossExcessMinor: after.grossExcessMinor,
        outstandingExcessMinor: after.outstandingExcessMinor,
        adjustments: [...before.adjustments, candidate],
      }),
    });
    await applyEntitlementEffects(tx, deps, order, after, input.reference);
    await input.afterProjection?.(tx, order);
  });
}

export async function recordExternalMoneyAdjustment(
  deps: AdjustmentDeps,
  command: RecordExternalMoneyAdjustmentCommand,
): Promise<BillingOrderView> {
  const occurredAtMs = new Date(command.occurredAt).getTime();
  if (!Number.isSafeInteger(command.amount) || command.amount <= 0 || Number.isNaN(occurredAtMs)) {
    throw new BillingDomainError('validation_error', 'Invalid money adjustment', 400);
  }
  const orderRef = await deps.adjustments.findOrderRef(command.orderId);
  const reference: AdjustmentReference = {
    type: command.type,
    externalReference: command.externalReference.trim(),
  };
  const replayCandidate: ReplayCandidate = {
    orderRef,
    amountMinor: command.amount,
    currency: command.currency,
    allocation: command.allocation,
    occurredAtMs,
  };

  const replay = await discriminateReplay(deps, reference, replayCandidate);
  if (replay) return replay;

  try {
    await commitAdjustment(deps, {
      orderRef,
      reference,
      candidate: () => ({
        type: command.type,
        allocation: command.allocation,
        amountMinor: command.amount,
      }),
      currency: command.currency,
      occurredAtMs,
      recordedBy: command.recordedBy,
    });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    // Two operators reached the insert at once. The winner's row is not
    // necessarily the same money, so it is discriminated exactly as a replay
    // is: identical is a success, anything else is a conflict, and a collision
    // on some *other* unique index is not this reference's to swallow.
    const raced = await discriminateReplay(deps, reference, replayCandidate);
    if (raced) return raced;
    throw error;
  }
  return deps.adjustments.readOrderView(orderRef);
}

/**
 * An operator's verdict on an overpayment, recorded as money rather than as a
 * flag.
 *
 * The old form set an enum on the order and wrote nothing to the ledger, so an
 * overpayment could read `refunded` while the accounting showed the money still
 * sitting there. Here the verdict *is* an excess-allocated adjustment; the
 * field on the order is derived from it in the same commit, and the queue
 * closes because the ledger closed it.
 */
export async function resolveOrderExcess(
  deps: AdjustmentDeps,
  command: ResolveOrderExcessCommand,
): Promise<BillingOrderView> {
  const reason = command.reason.trim();
  if (reason.length === 0 || reason.length > 1_000) {
    throw new BillingDomainError('validation_error', 'A resolution reason is required', 400);
  }
  const orderRef = await deps.adjustments.findOrderRef(command.orderId);
  const resolvedAtMs = deps.clock();
  // Stamped with the instant of the verdict rather than fixed per order: a
  // chargeback reversal can put an overpayment back on the queue, and a
  // per-order reference would refuse the second, entirely legitimate disposal
  // as a replay of the first. Two verdicts racing are serialised by the commit
  // they share, and two within the same millisecond collide here.
  const reference: AdjustmentReference = {
    type: excessAdjustmentTypeForCommand(command.command),
    externalReference: `excess-resolution:${command.orderId}:${resolvedAtMs}`,
  };

  try {
    await commitAdjustment(deps, {
      orderRef,
      reference,
      currency: 'VND',
      occurredAtMs: resolvedAtMs,
      recordedBy: command.recordedBy,
      // The whole outstanding surplus, read inside the commit: an operator
      // disposes of what is actually left, not of a figure the page showed
      // before someone else moved it.
      candidate: (order, ledger): LedgerAdjustment => {
        if (!canResolveExcess(order.excessResolution) || ledger.outstandingExcessMinor <= 0) {
          throw new BillingDomainError(
            'excess_not_resolvable',
            'The order has no outstanding overpayment to resolve',
            409,
          );
        }
        return {
          type: reference.type,
          allocation: 'excess',
          amountMinor: ledger.outstandingExcessMinor,
        };
      },
      afterProjection: async (tx, order) => {
        const recorded = await tx.recordExcessVerdict({
          orderRef: order.orderRef,
          reason,
          recordedBy: command.recordedBy,
          resolvedAtMs,
        });
        if (!recorded) {
          throw new BillingDomainError(
            'excess_not_resolvable',
            'The overpayment changed concurrently',
            409,
          );
        }
      },
    });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    throw new BillingDomainError(
      'excess_not_resolvable',
      'The overpayment has already been resolved',
      409,
    );
  }
  return deps.adjustments.readOrderView(orderRef);
}
