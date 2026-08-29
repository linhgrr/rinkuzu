import { describe, expect, it } from 'vitest';
import {
  admitAdjustment,
  deriveSettlementLedger,
  MONEY_ADJUSTMENT_TYPES,
  type LedgerAdjustment,
  type MoneyAdjustmentType,
  type SettlementLedgerInput,
} from './settlement-math';

const FINAL = 100_000;

function ledger(
  receivedMinor: number,
  adjustments: readonly LedgerAdjustment[] = [],
  finalMinor = FINAL,
): SettlementLedgerInput {
  return { receivedMinor, finalMinor, adjustments };
}

function principal(type: MoneyAdjustmentType, amountMinor: number): LedgerAdjustment {
  return { type, allocation: 'principal', amountMinor };
}

function excess(type: MoneyAdjustmentType, amountMinor: number): LedgerAdjustment {
  return { type, allocation: 'excess', amountMinor };
}

function permute<T>(values: readonly T[]): T[][] {
  if (values.length <= 1) return [[...values]];
  return values.flatMap((value, index) =>
    permute([...values.slice(0, index), ...values.slice(index + 1)]).map((rest) => [
      value,
      ...rest,
    ]),
  );
}

/**
 * These are the rules the module exists to enforce, and the ones the previous
 * last-event-wins implementation broke. Everything else derived here is
 * reporting; entitlement and admissibility are money.
 */
describe('entitlement follows the net ledger, never the latest event', () => {
  it('holds the entitlement when a chargeback is reversed', () => {
    const disputed = deriveSettlementLedger(ledger(FINAL, [principal('chargeback', FINAL)]));
    expect(disputed.entitled).toBe(false);
    expect(disputed.settlementStatus).toBe('charged_back');

    const reversed = deriveSettlementLedger(
      ledger(FINAL, [principal('chargeback', FINAL), principal('chargeback_reversal', FINAL)]),
    );
    expect(reversed.entitled).toBe(true);
    expect(reversed.netPrincipalMinor).toBe(FINAL);
    expect(reversed.outstandingChargebackMinor).toBe(0);
  });

  it('treats a merchant credit as payment toward what the order is owed', () => {
    expect(deriveSettlementLedger(ledger(FINAL - 5_000)).entitled).toBe(false);

    const credited = deriveSettlementLedger(ledger(FINAL - 5_000, [principal('credit', 5_000)]));
    expect(credited.entitled).toBe(true);
    expect(credited.creditedPrincipalMinor).toBe(5_000);
  });

  it('revokes on a full refund and revokes on a partial one', () => {
    const partial = deriveSettlementLedger(ledger(FINAL, [principal('refund', 1)]));
    expect(partial.entitled).toBe(false);
    expect(partial.settlementStatus).toBe('partially_refunded');

    const full = deriveSettlementLedger(ledger(FINAL, [principal('refund', FINAL)]));
    expect(full.settlementStatus).toBe('refunded');
    expect(full.netPrincipalMinor).toBe(0);
  });

  it('never derives an operator-only verdict', () => {
    // `disputed` and `review` are verdicts a person reaches. Automation that
    // could derive them would silently overwrite the person who set them.
    for (const received of [0, FINAL - 1, FINAL, FINAL * 2]) {
      for (const type of MONEY_ADJUSTMENT_TYPES) {
        const derived = deriveSettlementLedger(ledger(received, [principal(type, 1)]));
        expect(derived.settlementStatus).not.toBe('disputed');
        expect(derived.settlementStatus).not.toBe('review');
      }
    }
  });
});

describe('the ledger is order-independent', () => {
  // Adjustments arrive in whatever order the operator and the bank produce
  // them. A sum that depended on that order would make a customer's access
  // depend on which of two same-day events was keyed in first.
  const events: readonly LedgerAdjustment[] = [
    principal('chargeback', 40_000),
    principal('chargeback_reversal', 40_000),
    principal('refund', 10_000),
    principal('credit', 10_000),
  ];

  it('produces the same net principal under every permutation', () => {
    const permutations = permute(events);
    expect(permutations).toHaveLength(24);
    const nets = new Set(
      permutations.map((order) => deriveSettlementLedger(ledger(FINAL, order)).netPrincipalMinor),
    );
    expect(nets).toEqual(new Set([FINAL]));
  });
});

describe('admissibility is cumulative', () => {
  it('refuses a second refund that would exceed what was ever received', () => {
    expect(
      admitAdjustment({ ledger: ledger(FINAL), candidate: principal('refund', 60_000) }).admissible,
    ).toBe(true);

    const refused = admitAdjustment({
      ledger: ledger(FINAL, [principal('refund', 60_000)]),
      candidate: principal('refund', 60_000),
    });
    expect(refused.admissible).toBe(false);
    if (refused.admissible) throw new Error('Expected a refusal');
    expect(refused.code).toBe('adjustment_exceeds_payment');
  });

  it('refuses a credit that would put the order above what it is owed', () => {
    expect(
      admitAdjustment({ ledger: ledger(FINAL), candidate: principal('credit', 1) }).admissible,
    ).toBe(false);
  });

  it('lets a credit top up an underpaid order to exactly its total', () => {
    expect(
      admitAdjustment({ ledger: ledger(FINAL - 1), candidate: principal('credit', 1) }).admissible,
    ).toBe(true);
  });

  it('refuses to allocate against an overpayment that does not exist', () => {
    const refused = admitAdjustment({ ledger: ledger(FINAL), candidate: excess('refund', 1) });
    expect(refused.admissible).toBe(false);
    if (refused.admissible) throw new Error('Expected a refusal');
    expect(refused.code).toBe('adjustment_exceeds_excess');
  });

  it('refuses to dispose of more overpayment than arrived', () => {
    const over = ledger(FINAL + 5_000);
    expect(admitAdjustment({ ledger: over, candidate: excess('refund', 5_000) }).admissible).toBe(
      true,
    );
    expect(admitAdjustment({ ledger: over, candidate: excess('refund', 5_001) }).admissible).toBe(
      false,
    );
  });

  it('refuses a reversal when there is no chargeback for it to undo', () => {
    // The regression this pins: the only bound on a reversal used to be the
    // net-principal ceiling, and a refund lowers the net far enough that a
    // reversal of a chargeback nobody ever took fits underneath it and turns a
    // refunded order back into an entitled one.
    const refunded = ledger(FINAL, [principal('refund', FINAL)]);
    const refused = admitAdjustment({
      ledger: refunded,
      candidate: principal('chargeback_reversal', FINAL),
    });
    expect(refused.admissible).toBe(false);
    if (refused.admissible) throw new Error('Expected a refusal');
    expect(refused.code).toBe('reversal_without_chargeback');
    expect(deriveSettlementLedger(refunded).entitled).toBe(false);
  });

  it('refuses a reversal against an overpayment that a refund, not a chargeback, resolved', () => {
    const resolved = ledger(FINAL + 5_000, [excess('refund', 5_000)]);
    const refused = admitAdjustment({
      ledger: resolved,
      candidate: excess('chargeback_reversal', 5_000),
    });
    expect(refused.admissible).toBe(false);
    if (refused.admissible) throw new Error('Expected a refusal');
    expect(refused.code).toBe('reversal_without_chargeback');
  });

  it('admits a reversal up to the outstanding chargeback and no further', () => {
    const chargedBack = ledger(FINAL, [principal('chargeback', 40_000)]);
    expect(
      admitAdjustment({ ledger: chargedBack, candidate: principal('chargeback_reversal', 40_000) })
        .admissible,
    ).toBe(true);
    const refused = admitAdjustment({
      ledger: chargedBack,
      candidate: principal('chargeback_reversal', 40_001),
    });
    expect(refused.admissible).toBe(false);
    if (refused.admissible) throw new Error('Expected a refusal');
    expect(refused.code).toBe('reversal_exceeds_chargeback');
  });

  it('counts the outstanding chargeback cumulatively, so a reversal cannot be replayed', () => {
    const settled = ledger(FINAL, [
      principal('chargeback', 40_000),
      principal('chargeback_reversal', 40_000),
    ]);
    const refused = admitAdjustment({
      ledger: settled,
      candidate: principal('chargeback_reversal', 40_000),
    });
    expect(refused.admissible).toBe(false);
    if (refused.admissible) throw new Error('Expected a refusal');
    expect(refused.code).toBe('reversal_without_chargeback');
  });

  it('admits a reversal of a chargeback taken against the overpayment', () => {
    const chargedBack = ledger(FINAL + 5_000, [excess('chargeback', 5_000)]);
    expect(
      admitAdjustment({ ledger: chargedBack, candidate: excess('chargeback_reversal', 5_000) })
        .admissible,
    ).toBe(true);
    const refused = admitAdjustment({
      ledger: chargedBack,
      candidate: excess('chargeback_reversal', 5_001),
    });
    expect(refused.admissible).toBe(false);
    if (refused.admissible) throw new Error('Expected a refusal');
    expect(refused.code).toBe('reversal_exceeds_chargeback');
  });

  it('keeps the two allocations’ chargebacks separate', () => {
    // A chargeback against the principal is not a licence to reverse one
    // against the surplus: they are different money.
    const chargedBack = ledger(FINAL + 5_000, [principal('chargeback', 5_000)]);
    const refused = admitAdjustment({
      ledger: chargedBack,
      candidate: excess('chargeback_reversal', 5_000),
    });
    expect(refused.admissible).toBe(false);
    if (refused.admissible) throw new Error('Expected a refusal');
    expect(refused.code).toBe('reversal_without_chargeback');
  });

  it('rejects amounts that are not positive integers in minor units', () => {
    for (const amountMinor of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2]) {
      const refused = admitAdjustment({
        ledger: ledger(FINAL),
        candidate: principal('refund', amountMinor),
      });
      expect(refused.admissible).toBe(false);
      if (refused.admissible) throw new Error('Expected a refusal');
      expect(refused.code).toBe('validation_error');
    }
  });

  it('never admits a sequence that drives the net principal out of bounds', () => {
    // Swept rather than sampled: a per-adjustment bound is only worth something
    // if no reachable sequence of individually-admitted adjustments overdraws.
    let accumulated: LedgerAdjustment[] = [];
    for (let step = 0; step < 40; step += 1) {
      const type = MONEY_ADJUSTMENT_TYPES[step % MONEY_ADJUSTMENT_TYPES.length];
      if (type === undefined) throw new Error('Adjustment type table is empty');
      const candidate = principal(type, 7_000 + step * 313);
      if (admitAdjustment({ ledger: ledger(FINAL, accumulated), candidate }).admissible) {
        accumulated = [...accumulated, candidate];
      }
      const derived = deriveSettlementLedger(ledger(FINAL, accumulated));
      expect(derived.netPrincipalMinor).toBeGreaterThanOrEqual(0);
      expect(derived.netPrincipalMinor).toBeLessThanOrEqual(FINAL);
    }
  });
});
