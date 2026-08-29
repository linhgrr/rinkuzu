import type { LedgerAdjustment, MoneyAdjustmentType } from './settlement-math';

/**
 * What happened to money a customer paid over the order total.
 *
 * An overpayment is the one billing state automation can detect but must never
 * close on its own: only a person can decide whether the surplus is returned,
 * turned into credit, or kept. That verdict used to be a bare enum on the
 * order, written by an operator command that recorded no money anywhere — so
 * the queue said `refunded` while the ledger said nothing had moved, and the
 * derivation had to be deliberately blinded to terminal states to stop it
 * reopening every closed case on the next tick.
 *
 * There is one source of truth now. An operator's verdict is an
 * `ExternalMoneyAdjustment` allocated to the excess like any other money event,
 * and the field on the order is a projection of that ledger, derived here and
 * refreshed by every path that touches the order. Nothing has to be blinded,
 * because a derivation over the whole ledger cannot disagree with it.
 */

export const EXCESS_RESOLUTIONS = [
  'none',
  'unallocated',
  'refunded',
  'credited',
  'written_off',
] as const;
export type ExcessResolution = (typeof EXCESS_RESOLUTIONS)[number];

/** What an operator can decide to do with an overpayment. */
export const EXCESS_RESOLUTION_COMMANDS = ['refund', 'credit', 'write_off'] as const;
export type ExcessResolutionCommand = (typeof EXCESS_RESOLUTION_COMMANDS)[number];

const COMMAND_ADJUSTMENT: Record<ExcessResolutionCommand, MoneyAdjustmentType> = {
  refund: 'refund',
  credit: 'credit',
  write_off: 'write_off',
};

/** The money event an operator command records against the overpayment. */
export function excessAdjustmentTypeForCommand(
  command: ExcessResolutionCommand,
): MoneyAdjustmentType {
  return COMMAND_ADJUSTMENT[command];
}

/**
 * How a disposed overpayment is labelled when more than one kind of event
 * disposed of it. Money that actually went back to the customer is the
 * strongest statement about the surplus, then money the merchant granted, then
 * money it simply kept, so a part-refunded, part-written-off overpayment reads
 * as refunded rather than as the accounting convenience that closed the rest.
 *
 * A chargeback against the surplus is labelled the same as a refund: the
 * customer has the money either way, and the difference is who initiated it.
 * Every disposing event needs a label — one that fell through would report an
 * overpayment as still awaiting a decision that nobody can make, because the
 * surplus it would decide is already gone.
 */
interface ResolutionLabel {
  readonly type: MoneyAdjustmentType;
  readonly resolution: ExcessResolution;
}

const RESOLUTION_PRECEDENCE: readonly ResolutionLabel[] = [
  { type: 'refund', resolution: 'refunded' },
  { type: 'chargeback', resolution: 'refunded' },
  { type: 'credit', resolution: 'credited' },
  { type: 'write_off', resolution: 'written_off' },
];

export interface ExcessResolutionInput {
  /** Overpayment the payment ledger reports, before any disposal. */
  readonly grossExcessMinor: number;
  /** How much of that overpayment nobody has disposed of yet. */
  readonly outstandingExcessMinor: number;
  /** Every adjustment recorded against the order, any allocation. */
  readonly adjustments: readonly LedgerAdjustment[];
}

export function deriveExcessResolution(input: ExcessResolutionInput): ExcessResolution {
  if (input.grossExcessMinor === 0) return 'none';
  if (input.outstandingExcessMinor > 0) return 'unallocated';
  const disposals = new Set(
    input.adjustments.filter((entry) => entry.allocation === 'excess').map((entry) => entry.type),
  );
  return (
    RESOLUTION_PRECEDENCE.find((candidate) => disposals.has(candidate.type))?.resolution ??
    'unallocated'
  );
}

/**
 * True when an operator command may be applied. `none` means there is nothing
 * to dispose of and the three terminal states are already disposed of; both are
 * conflicts rather than repeats, so the caller reports them rather than quietly
 * succeeding.
 */
export function canResolveExcess(current: ExcessResolution): boolean {
  return current === 'unallocated';
}
