import { describe, expect, it } from 'vitest';
import {
  canResolveExcess,
  deriveExcessResolution,
  EXCESS_RESOLUTION_COMMANDS,
  EXCESS_RESOLUTIONS,
  excessAdjustmentTypeForCommand,
  type ExcessResolution,
} from './excess-resolution';
import { deriveSettlementLedger, type LedgerAdjustment } from './settlement-math';

/**
 * The overpayment verdict used to be a bare enum written by a command that
 * moved no money, so the order could say `refunded` while the ledger said
 * nothing had happened. It is a projection of the adjustment ledger now, and
 * these tests exist to keep it one: every expectation below is stated in terms
 * of the adjustments recorded, never of a flag someone set.
 */

function excess(amountMinor: number, type: LedgerAdjustment['type']): LedgerAdjustment {
  return { type, allocation: 'excess', amountMinor };
}

/** Derives the resolution the way the settlement path does: from one ledger. */
function resolutionFor(
  receivedMinor: number,
  finalMinor: number,
  adjustments: readonly LedgerAdjustment[],
): ExcessResolution {
  const ledger = deriveSettlementLedger({ receivedMinor, finalMinor, adjustments });
  return deriveExcessResolution({
    grossExcessMinor: ledger.grossExcessMinor,
    outstandingExcessMinor: ledger.outstandingExcessMinor,
    adjustments,
  });
}

describe('deriveExcessResolution', () => {
  it('reports no overpayment when the customer paid exactly or too little', () => {
    expect(resolutionFor(100_000, 100_000, [])).toBe('none');
    expect(resolutionFor(40_000, 100_000, [])).toBe('none');
  });

  it('parks an undisposed overpayment in the queue with no automatic exit', () => {
    expect(resolutionFor(120_000, 100_000, [])).toBe('unallocated');
  });

  it('labels a disposed overpayment by the money event that disposed of it', () => {
    for (const command of EXCESS_RESOLUTION_COMMANDS) {
      const adjustment = excess(20_000, excessAdjustmentTypeForCommand(command));
      const expected: Record<typeof command, ExcessResolution> = {
        refund: 'refunded',
        credit: 'credited',
        write_off: 'written_off',
      };
      expect(resolutionFor(120_000, 100_000, [adjustment])).toBe(expected[command]);
    }
  });

  it('stays unallocated while any part of the surplus is still undisposed', () => {
    // A part refund is not a verdict on the rest, and reporting one would take
    // the order off the operator queue with money still sitting on it.
    expect(resolutionFor(120_000, 100_000, [excess(5_000, 'refund')])).toBe('unallocated');
  });

  it('reports the strongest statement about the surplus when two events split it', () => {
    // Money that actually went back to the customer outranks money the merchant
    // granted, which outranks money it simply kept.
    expect(
      resolutionFor(120_000, 100_000, [excess(10_000, 'write_off'), excess(10_000, 'refund')]),
    ).toBe('refunded');
    expect(
      resolutionFor(120_000, 100_000, [excess(10_000, 'write_off'), excess(10_000, 'credit')]),
    ).toBe('credited');
  });

  it('reopens the queue when a chargeback against the surplus is reversed', () => {
    const chargedBack = [excess(20_000, 'chargeback')];
    // The customer has the surplus, so it reads the same as a refund rather
    // than falling through to "still waiting for a decision".
    expect(resolutionFor(120_000, 100_000, chargedBack)).toBe('refunded');
    // The reversal un-resolves what the chargeback resolved, so the surplus is
    // outstanding again rather than staying labelled by a reversed event.
    expect(
      resolutionFor(120_000, 100_000, [...chargedBack, excess(20_000, 'chargeback_reversal')]),
    ).toBe('unallocated');
  });

  it('cannot be reopened by a later observation once the ledger closed it', () => {
    // The bug this replaced: the derivation was blinded to terminal states so a
    // reconciliation would not overwrite them. Re-deriving from the same ledger
    // is idempotent, so nothing has to be blinded.
    const adjustments = [excess(20_000, 'refund')];
    const first = resolutionFor(120_000, 100_000, adjustments);
    const second = resolutionFor(120_000, 100_000, adjustments);
    expect(first).toBe('refunded');
    expect(second).toBe(first);
  });
});

describe('excessAdjustmentTypeForCommand', () => {
  it('gives every operator command exactly one money event, and no two the same', () => {
    const types = EXCESS_RESOLUTION_COMMANDS.map(excessAdjustmentTypeForCommand);
    expect(new Set(types).size).toBe(EXCESS_RESOLUTION_COMMANDS.length);
    // Every command must record money moving. A command whose event resolved
    // nothing would leave the surplus outstanding and the verdict invisible.
    for (const type of types) {
      expect(resolutionFor(120_000, 100_000, [excess(20_000, type)])).not.toBe('unallocated');
    }
  });
});

describe('canResolveExcess', () => {
  it('admits exactly the one state that is waiting for a decision', () => {
    const admissible = EXCESS_RESOLUTIONS.filter((state: ExcessResolution) =>
      canResolveExcess(state),
    );
    expect(admissible).toEqual(['unallocated']);
  });

  it('refuses to re-decide an overpayment the ledger already closed', () => {
    // Reported as a conflict rather than quietly succeeding: the second
    // operator needs to know the money already went somewhere.
    for (const state of ['refunded', 'credited', 'written_off'] as const) {
      expect(canResolveExcess(state)).toBe(false);
    }
  });
});
