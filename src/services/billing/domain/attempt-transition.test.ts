import { describe, expect, it } from 'vitest';
import {
  ATTEMPT_STATES,
  decideAttemptTransition,
  interpretProviderStatus,
  OPEN_ATTEMPT_STATES,
  TERMINAL_ATTEMPT_STATES,
  type AttemptObservationInput,
  type AttemptState,
  type AttemptTransition,
  type ObservedCollection,
} from './attempt-transition';

const NOW = Date.UTC(2026, 6, 1, 12, 0, 0);

// Everything the provider can report that the machine is willing to adopt.
// Spelled out rather than imported so a new observable status has to be
// deliberately added here before these invariants claim to cover it.
const OBSERVABLE: readonly ObservedCollection[] = [
  'pending',
  'partial',
  'paid',
  'cancelled',
  'expired',
];

function isOpen(state: AttemptState): boolean {
  return (OPEN_ATTEMPT_STATES as readonly string[]).includes(state);
}

function isTerminal(state: AttemptState): boolean {
  return (TERMINAL_ATTEMPT_STATES as readonly string[]).includes(state);
}

function observe(overrides: Partial<AttemptObservationInput> = {}): AttemptTransition {
  return decideAttemptTransition({
    current: 'pending',
    observed: 'pending',
    amountPaidMinor: 0,
    expiresAtMs: NOW + 3_600_000,
    createdAtMs: NOW - 60_000,
    settledAtMs: null,
    nowMs: NOW,
    random: () => 0.5,
    ...overrides,
  });
}

describe('interpretProviderStatus', () => {
  it('only calls a payment paid when the provider owes nothing more', () => {
    expect(
      interpretProviderStatus({
        status: 'PAID',
        amountMinor: 100_000,
        amountPaidMinor: 100_000,
        amountRemainingMinor: 0,
      }),
    ).toBe('paid');
    expect(
      interpretProviderStatus({
        status: 'PAID',
        amountMinor: 100_000,
        amountPaidMinor: 40_000,
        amountRemainingMinor: 60_000,
      }),
    ).toBe('partial');
  });

  it('reports money before status for any non-paid provider status', () => {
    for (const status of ['PENDING', 'PROCESSING', 'CANCELLED', 'EXPIRED']) {
      expect(
        interpretProviderStatus({
          status,
          amountMinor: 100_000,
          amountPaidMinor: 1,
          amountRemainingMinor: 99_999,
        }),
      ).toBe('partial');
    }
  });

  it('refuses to adopt a status it does not know', () => {
    expect(
      interpretProviderStatus({
        status: 'SOMETHING_NEW',
        amountMinor: 100_000,
        amountPaidMinor: 0,
        amountRemainingMinor: 100_000,
      }),
    ).toBe('unrecognized');
  });
});

describe('attempt state vocabulary', () => {
  it('splits every state into exactly one of open or terminal, with review in neither', () => {
    for (const state of ATTEMPT_STATES) {
      expect(isOpen(state) && isTerminal(state)).toBe(false);
      expect(isOpen(state) || isTerminal(state)).toBe(state !== 'review');
    }
  });
});

describe('local expiry', () => {
  it('closes a lapsed unpaid link the provider still calls pending', () => {
    expect(
      observe({ observed: 'pending', amountPaidMinor: 0, expiresAtMs: NOW - 1 }),
    ).toMatchObject({ kind: 'settle', state: 'expired' });
  });

  it('never expires an attempt that has money against it', () => {
    const transition = observe({
      observed: 'pending',
      amountPaidMinor: 1,
      expiresAtMs: NOW - 1,
    });
    expect(transition).not.toMatchObject({ state: 'expired' });
  });

  it('does not override a status the provider already settled', () => {
    for (const observed of OBSERVABLE.filter((state) => state !== 'pending')) {
      const transition = observe({
        observed,
        amountPaidMinor: observed === 'partial' ? 40_000 : 0,
        expiresAtMs: NOW - 1,
      });
      if (transition.kind === 'settle' || transition.kind === 'advance') {
        expect(transition.state).toBe(observed);
      }
    }
  });
});

describe('decideAttemptTransition', () => {
  it('escalates an unrecognized provider status instead of adopting it', () => {
    expect(observe({ observed: 'unrecognized' })).toEqual({
      kind: 'escalate',
      reason: 'provider_status_unrecognized',
      // A status the ladder cannot read leaves the whole order unaccounted
      // for, so the order is handed over with the attempt.
      freezesOrder: true,
    });
  });

  it('gives every automatic non-terminal transition a future follow-up and never picks review', () => {
    for (const current of ATTEMPT_STATES) {
      for (const observed of OBSERVABLE) {
        const transition = observe({
          current,
          observed,
          amountPaidMinor: observed === 'partial' ? 40_000 : 0,
          settledAtMs: isTerminal(current) ? NOW - 60_000 : null,
        });
        if (transition.kind === 'advance') {
          expect(transition.followUp.atMs).toBeGreaterThan(NOW);
          expect(isOpen(transition.state)).toBe(true);
          expect(transition.state as AttemptState).not.toBe('review');
        }
        if (transition.kind === 'settle') {
          expect(isTerminal(transition.state)).toBe(true);
        }
      }
    }
  });

  it('never schedules an escalation, so review cannot starve the queue', () => {
    const transition = observe({ current: 'cancelled', observed: 'partial', amountPaidMinor: 1 });
    // The attempt needs an operator, but the money is a fact: the order keeps
    // the collection state its own ledger supports and stays visible.
    expect(transition).toEqual({
      kind: 'escalate',
      reason: 'unapplicable_money_observation',
      freezesOrder: false,
    });
    expect(transition).not.toHaveProperty('followUp');
  });

  it('lets money escape a closed attempt only as a full payment', () => {
    expect(
      observe({ current: 'cancelled', observed: 'paid', amountPaidMinor: 100_000 }),
    ).toMatchObject({ kind: 'settle', state: 'paid' });
    expect(
      observe({ current: 'expired', observed: 'paid', amountPaidMinor: 100_000 }),
    ).toMatchObject({ kind: 'settle', state: 'paid' });
  });

  it('never lets an out-of-order event downgrade paid', () => {
    for (const observed of OBSERVABLE.filter((state) => state !== 'paid')) {
      expect(observe({ current: 'paid', observed, amountPaidMinor: 0 })).toEqual({ kind: 'hold' });
    }
  });

  it('does not re-escalate an attempt an operator already owns', () => {
    expect(observe({ current: 'review', observed: 'partial', amountPaidMinor: 40_000 })).toEqual({
      kind: 'hold',
    });
  });

  it('lets a full payment take an attempt back out of review', () => {
    expect(
      observe({ current: 'review', observed: 'paid', amountPaidMinor: 100_000 }),
    ).toMatchObject({
      kind: 'settle',
      state: 'paid',
    });
  });

  it('watches a freshly settled attempt for late money and then lets it go', () => {
    const fresh = observe({ observed: 'cancelled', settledAtMs: null });
    if (fresh.kind !== 'settle') throw new Error('expected settle');
    expect(fresh.watch?.atMs).toBeGreaterThan(NOW);

    expect(
      observe({
        current: 'cancelled',
        observed: 'cancelled',
        settledAtMs: NOW - 8 * 86_400_000,
      }),
    ).toEqual({ kind: 'settle', state: 'cancelled', watch: null });
  });

  it('closes a lapsed pending attempt as expired without waiting for the provider', () => {
    expect(observe({ observed: 'pending', expiresAtMs: NOW - 1 })).toMatchObject({
      kind: 'settle',
      state: 'expired',
    });
  });

  it('holds an observation that is already reflected', () => {
    expect(observe({ current: 'pending', observed: 'pending' })).toMatchObject({ kind: 'advance' });
    expect(
      observe({ current: 'cancelled', observed: 'pending', settledAtMs: NOW - 60_000 }),
    ).toEqual({ kind: 'hold' });
  });
});
