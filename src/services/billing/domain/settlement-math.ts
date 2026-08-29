/**
 * The money algebra for one order.
 *
 * Everything an order is owed, has received, and has given back is folded into
 * a single net figure here, and entitlement is decided from that figure alone.
 * The previous rule switched on the *type* of the most recent adjustment, so a
 * chargeback that was later reversed left the customer permanently revoked and
 * a second refund against an already fully refunded order was accepted. Both
 * are unrepresentable once the ledger, rather than the last event, is the
 * authority.
 *
 * Pure: no clock, no persistence, no configuration.
 */

export const MONEY_ADJUSTMENT_TYPES = [
  'refund',
  'chargeback',
  'chargeback_reversal',
  'credit',
  'write_off',
] as const;
export type MoneyAdjustmentType = (typeof MONEY_ADJUSTMENT_TYPES)[number];

export const MONEY_ALLOCATIONS = ['principal', 'excess'] as const;
export type MoneyAllocation = (typeof MONEY_ALLOCATIONS)[number];

/**
 * How each adjustment type moves the principal the merchant has actually kept.
 * A credit is money the merchant grants out of its own pocket, so it counts
 * toward what the order is owed exactly as a payment would.
 */
const PRINCIPAL_SIGN: Record<MoneyAdjustmentType, number> = {
  refund: -1,
  chargeback: -1,
  chargeback_reversal: 1,
  credit: 1,
  write_off: -1,
};

/**
 * How each adjustment type moves the amount of an overpayment that has been
 * dealt with. A reversal un-resolves what its chargeback resolved.
 */
const EXCESS_RESOLVING_SIGN: Record<MoneyAdjustmentType, number> = {
  refund: 1,
  chargeback: 1,
  chargeback_reversal: -1,
  credit: 1,
  write_off: 1,
};

export interface LedgerAdjustment {
  readonly type: MoneyAdjustmentType;
  readonly allocation: MoneyAllocation;
  readonly amountMinor: number;
}

export interface SettlementLedgerInput {
  /** Sum of incoming provider payments against the order, in minor units. */
  readonly receivedMinor: number;
  /** What the order is owed, in minor units. */
  readonly finalMinor: number;
  /** Every external money adjustment recorded against the order. */
  readonly adjustments: readonly LedgerAdjustment[];
}

/**
 * The stored settlement states.
 *
 * Every one of them is derived from the ledger below. There is deliberately no
 * operator-only value: a status nothing computes and nothing writes is a field
 * that drifts silently away from the money it claims to describe, which is what
 * `disputed`, `reversed` and `review` were doing here.
 */
export const SETTLEMENT_STATES = [
  'unsettled',
  'settled',
  'partially_refunded',
  'refunded',
  'charged_back',
] as const;
export type SettlementState = (typeof SETTLEMENT_STATES)[number];

interface SettlementTotals {
  /** Money the merchant has kept against this order, credits included. */
  readonly netPrincipalMinor: number;
  readonly refundedPrincipalMinor: number;
  /** Chargebacks that have not been reversed. */
  readonly outstandingChargebackMinor: number;
  readonly reversedPrincipalMinor: number;
  readonly creditedPrincipalMinor: number;
  readonly writtenOffPrincipalMinor: number;
  /** Overpayment observed from the payment ledger, before any resolution. */
  readonly grossExcessMinor: number;
  /** Overpayment nobody has disposed of yet. */
  readonly outstandingExcessMinor: number;
  /** Chargebacks taken against the overpayment that were not reversed. */
  readonly outstandingExcessChargebackMinor: number;
}

export interface SettlementLedger extends SettlementTotals {
  /**
   * Whether the order has paid for what it bought. This, and never the type of
   * the latest adjustment, decides whether the entitlement stands.
   */
  readonly entitled: boolean;
  readonly settlementStatus: SettlementState;
}

function sumAllocated(
  adjustments: readonly LedgerAdjustment[],
  allocation: MoneyAllocation,
  target: MoneyAdjustmentType,
): number {
  return adjustments
    .filter((entry) => entry.allocation === allocation && entry.type === target)
    .reduce((total, entry) => total + entry.amountMinor, 0);
}

/**
 * The settlement status of an order, derived so that it can never contradict
 * the entitlement derived beside it.
 *
 * `settled` is tested first and is exactly the entitlement predicate, which is
 * the whole invariant: an order reports settled if and only if the customer is
 * entitled to what they bought. The previous rule tested adjustment *types* in
 * a fixed order, so `chargeback → reversal → refund` reported `reversed` on a
 * fully refunded order, and a chargeback made whole by a merchant credit
 * reported `charged_back` on an order the customer was entitled to. Neither
 * sequence is representable now.
 */
function deriveSettlementStatus(
  totals: SettlementTotals,
  input: SettlementLedgerInput,
  entitled: boolean,
): SettlementState {
  if (entitled) return 'settled';
  if (totals.outstandingChargebackMinor > 0) return 'charged_back';
  const returnedMinor = totals.refundedPrincipalMinor + totals.writtenOffPrincipalMinor;
  if (returnedMinor === 0) return 'unsettled';
  const keptMinor = input.receivedMinor + totals.creditedPrincipalMinor;
  return totals.netPrincipalMinor <= 0 && keptMinor > 0 ? 'refunded' : 'partially_refunded';
}

export function deriveSettlementLedger(input: SettlementLedgerInput): SettlementLedger {
  const principalDelta = input.adjustments
    .filter((entry) => entry.allocation === 'principal')
    .reduce((total, entry) => total + PRINCIPAL_SIGN[entry.type] * entry.amountMinor, 0);
  const excessResolvedMinor = input.adjustments
    .filter((entry) => entry.allocation === 'excess')
    .reduce((total, entry) => total + EXCESS_RESOLVING_SIGN[entry.type] * entry.amountMinor, 0);

  const chargedBack = sumAllocated(input.adjustments, 'principal', 'chargeback');
  const reversed = sumAllocated(input.adjustments, 'principal', 'chargeback_reversal');
  const excessChargedBack = sumAllocated(input.adjustments, 'excess', 'chargeback');
  const excessReversed = sumAllocated(input.adjustments, 'excess', 'chargeback_reversal');
  const grossExcessMinor = Math.max(0, input.receivedMinor - input.finalMinor);

  const totals: SettlementTotals = {
    netPrincipalMinor: input.receivedMinor + principalDelta,
    refundedPrincipalMinor: sumAllocated(input.adjustments, 'principal', 'refund'),
    outstandingChargebackMinor: Math.max(0, chargedBack - reversed),
    reversedPrincipalMinor: reversed,
    creditedPrincipalMinor: sumAllocated(input.adjustments, 'principal', 'credit'),
    writtenOffPrincipalMinor: sumAllocated(input.adjustments, 'principal', 'write_off'),
    grossExcessMinor,
    outstandingExcessMinor: grossExcessMinor - excessResolvedMinor,
    outstandingExcessChargebackMinor: Math.max(0, excessChargedBack - excessReversed),
  };

  const entitled = totals.netPrincipalMinor >= input.finalMinor;
  return {
    ...totals,
    entitled,
    settlementStatus: deriveSettlementStatus(totals, input, entitled),
  };
}

interface AdjustmentAdmissible {
  readonly admissible: true;
}

interface AdjustmentRefused {
  readonly admissible: false;
  readonly code: string;
  readonly message: string;
}

export type AdjustmentAdmissibility = AdjustmentAdmissible | AdjustmentRefused;

export interface AdjustmentCandidateInput {
  readonly ledger: SettlementLedgerInput;
  readonly candidate: LedgerAdjustment;
}

function refuse(code: string, message: string): AdjustmentRefused {
  return { admissible: false, code, message };
}

/**
 * A reversal undoes a chargeback, so there has to be one to undo.
 *
 * Without this the only bound on a reversal was the net-principal ceiling, and
 * a refund lowers the net far enough that a reversal of a chargeback that was
 * never taken — or one larger than the chargeback that was — fits underneath it
 * and turns a refunded order back into an entitled one.
 */
function admitReversal(
  candidate: LedgerAdjustment,
  current: SettlementLedger,
): AdjustmentAdmissibility {
  const outstandingMinor =
    candidate.allocation === 'principal'
      ? current.outstandingChargebackMinor
      : current.outstandingExcessChargebackMinor;
  if (outstandingMinor === 0) {
    return refuse(
      'reversal_without_chargeback',
      'There is no outstanding chargeback for this reversal to undo',
    );
  }
  if (candidate.amountMinor > outstandingMinor) {
    return refuse(
      'reversal_exceeds_chargeback',
      'The reversal is larger than the outstanding chargeback',
    );
  }
  return { admissible: true };
}

/**
 * Whether one more adjustment can be recorded against the order.
 *
 * The bound is cumulative, which is the whole point: refunding 60% of a payment
 * twice is two individually admissible adjustments and one inadmissible ledger.
 */
export function admitAdjustment(input: AdjustmentCandidateInput): AdjustmentAdmissibility {
  const candidate = input.candidate;
  if (!Number.isSafeInteger(candidate.amountMinor) || candidate.amountMinor <= 0) {
    return refuse(
      'validation_error',
      'Adjustment amount must be a positive integer in minor units',
    );
  }

  if (candidate.type === 'chargeback_reversal') {
    const reversal = admitReversal(candidate, deriveSettlementLedger(input.ledger));
    if (!reversal.admissible) return reversal;
  }

  const projected = deriveSettlementLedger({
    ...input.ledger,
    adjustments: [...input.ledger.adjustments, candidate],
  });

  if (candidate.allocation === 'principal') {
    if (projected.netPrincipalMinor < 0) {
      return refuse(
        'adjustment_exceeds_payment',
        'Adjustments would return more than the order ever received',
      );
    }
    const ceiling = Math.max(input.ledger.receivedMinor, input.ledger.finalMinor);
    if (PRINCIPAL_SIGN[candidate.type] > 0 && projected.netPrincipalMinor > ceiling) {
      return refuse(
        'adjustment_exceeds_payment',
        'Adjustments would credit the order beyond what it is owed',
      );
    }
    return { admissible: true };
  }

  if (projected.grossExcessMinor === 0) {
    return refuse('adjustment_exceeds_excess', 'The order has no overpayment to allocate');
  }
  if (projected.outstandingExcessMinor < 0) {
    return refuse(
      'adjustment_exceeds_excess',
      'Adjustments would dispose of more than the overpayment',
    );
  }
  if (projected.outstandingExcessMinor > projected.grossExcessMinor) {
    return refuse('adjustment_exceeds_excess', 'Reversing more excess than was resolved');
  }
  return { admissible: true };
}
