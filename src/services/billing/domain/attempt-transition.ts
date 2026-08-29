import { FollowUp, retryFollowUp, terminalWatchFollowUp } from './schedule';

/**
 * The payment attempt state machine.
 *
 * Three properties this module exists to guarantee:
 *
 * 1. Automation never leaves an open attempt without a next check. An
 *    `advance` structurally carries a `FollowUp`, so the "returned early and
 *    never rescheduled" starvation bug cannot be written.
 * 2. `review` is operator-owned. No ladder step selects it; it is only ever
 *    reached through an explicit `escalate`, which deliberately carries no
 *    follow-up so automation stops touching the attempt until a human resolves
 *    it. Selecting `review` for reconciliation is what turned a single bad
 *    attempt into a permanent hot loop.
 * 3. Observed money is never a silent no-op. Money that the ladder refuses
 *    becomes an operator discrepancy rather than being dropped.
 */

export const ATTEMPT_STATES = [
  'creating',
  'pending',
  'partial',
  'paid',
  'cancelled',
  'expired',
  'failed',
  'review',
] as const;
export type AttemptState = (typeof ATTEMPT_STATES)[number];

/** States automation is allowed to keep polling. */
export const OPEN_ATTEMPT_STATES = ['creating', 'pending', 'partial'] as const;
type OpenAttemptState = (typeof OPEN_ATTEMPT_STATES)[number];

/** States where collection is finished, successfully or not. */
export const TERMINAL_ATTEMPT_STATES = ['paid', 'cancelled', 'expired', 'failed'] as const;
type TerminalAttemptState = (typeof TERMINAL_ATTEMPT_STATES)[number];

function isTerminalAttemptState(state: AttemptState): state is TerminalAttemptState {
  return (TERMINAL_ATTEMPT_STATES as readonly string[]).includes(state);
}

/** Why an attempt was handed to an operator instead of being moved on its own. */
export type AttemptEscalationReason =
  | 'provider_invariant_mismatch'
  | 'provider_transaction_identity_collision'
  | 'provider_ledger_amount_mismatch'
  | 'provider_status_unrecognized'
  | 'unapplicable_money_observation'
  | 'reconciliation_stalled';

/**
 * What the provider says about a payment, translated into the vocabulary the
 * state machine understands. `unrecognized` is deliberately not a state: an
 * unknown provider status is an escalation input, never a status we adopt.
 */
export type ObservedCollection =
  | 'pending'
  | 'partial'
  | 'paid'
  | 'cancelled'
  | 'expired'
  | 'unrecognized';

/** Everything the provider can tell us that we are willing to adopt as state. */
type ObservedAttemptState = Exclude<ObservedCollection, 'unrecognized'>;

export interface ProviderStatusInput {
  readonly status: string;
  readonly amountMinor: number;
  readonly amountPaidMinor: number;
  readonly amountRemainingMinor: number;
}

export function interpretProviderStatus(input: ProviderStatusInput): ObservedCollection {
  if (
    input.status === 'PAID' &&
    input.amountPaidMinor >= input.amountMinor &&
    input.amountRemainingMinor === 0
  ) {
    return 'paid';
  }
  if (input.amountPaidMinor > 0) return 'partial';
  if (input.status === 'CANCELLED') return 'cancelled';
  if (input.status === 'EXPIRED') return 'expired';
  if (input.status === 'PENDING' || input.status === 'PROCESSING') return 'pending';
  return 'unrecognized';
}

interface LocalExpiryInput {
  readonly observed: ObservedCollection;
  readonly amountPaidMinor: number;
  /** The checkout deadline we handed the provider, in epoch milliseconds. */
  readonly expiresAtMs: number;
  readonly nowMs: number;
}

/**
 * True when our own checkout deadline has passed with no money against the
 * attempt. Closing on the local deadline instead of waiting for the provider to
 * agree unblocks the replacement attempt and releases the promo reservation.
 * Money always beats the deadline, which is why zero paid is required here.
 */
function isLocallyExpiredAttempt(input: LocalExpiryInput): boolean {
  return (
    input.amountPaidMinor === 0 && input.expiresAtMs < input.nowMs && input.observed === 'pending'
  );
}

const COLLECTION_RANK: Record<AttemptState, number> = {
  creating: 0,
  pending: 1,
  partial: 2,
  cancelled: 3,
  expired: 3,
  failed: 3,
  review: 4,
  paid: 5,
};

/**
 * The monotonic ladder. `paid` always wins because money is the strongest fact
 * the provider can report; nothing escapes `paid`, and only `paid` escapes
 * `review`.
 */
function canApplyCollectionTransition(current: AttemptState, next: AttemptState): boolean {
  if (current === next) return true;
  if (next === 'paid') return true;
  if (current === 'paid' || current === 'review') return false;
  return COLLECTION_RANK[next] >= COLLECTION_RANK[current];
}

/** Nothing to write: the observation is already reflected and no money moved. */
interface AttemptHold {
  readonly kind: 'hold';
}

/**
 * The attempt stays open. `followUp` is required, so an open attempt can never
 * be written back without a next check.
 */
interface AttemptAdvance {
  readonly kind: 'advance';
  readonly state: OpenAttemptState;
  readonly followUp: FollowUp;
}

/**
 * Collection is finished. `watch` is a bounded low-frequency re-check for money
 * the provider reports after the fact, and `null` once the watch horizon has
 * passed and the attempt should leave the queue for good.
 */
interface AttemptSettle {
  readonly kind: 'settle';
  readonly state: TerminalAttemptState;
  readonly watch: FollowUp | null;
}

/**
 * Hand the attempt to an operator. There is deliberately no follow-up: an
 * escalated attempt must stop being selected by automation, otherwise it is
 * re-picked every tick and starves every other attempt behind it.
 */
interface AttemptEscalate {
  readonly kind: 'escalate';
  readonly reason: AttemptEscalationReason;
  /**
   * Whether the order's own money is in doubt as well as the attempt's.
   *
   * Money the ladder refuses is still money that can be accounted for: the
   * attempt needs an operator, but the order's received amount is a fact and
   * has to stay visible to the customer and to whoever resolves it. A ledger
   * that contradicts itself is the other case — there the order's totals are
   * exactly what cannot be trusted, so the order is frozen with the attempt.
   */
  readonly freezesOrder: boolean;
}

export type AttemptTransition = AttemptHold | AttemptAdvance | AttemptSettle | AttemptEscalate;

export interface AttemptObservationInput {
  readonly current: AttemptState;
  readonly observed: ObservedCollection;
  readonly amountPaidMinor: number;
  readonly expiresAtMs: number;
  /** When the attempt row was created, in epoch milliseconds. */
  readonly createdAtMs: number;
  /** When the attempt was confirmed terminal, or `null` if it never was. */
  readonly settledAtMs: number | null;
  readonly nowMs: number;
  readonly random?: () => number;
}

export function decideAttemptTransition(input: AttemptObservationInput): AttemptTransition {
  if (input.observed === 'unrecognized') {
    return { kind: 'escalate', reason: 'provider_status_unrecognized', freezesOrder: true };
  }

  const random = input.random ?? Math.random;
  const effective: ObservedAttemptState = isLocallyExpiredAttempt({
    observed: input.observed,
    amountPaidMinor: input.amountPaidMinor,
    expiresAtMs: input.expiresAtMs,
    nowMs: input.nowMs,
  })
    ? 'expired'
    : input.observed;

  if (!canApplyCollectionTransition(input.current, effective)) {
    // Money the ladder refuses is never dropped: it becomes a discrepancy an
    // operator has to resolve. An attempt already in review is left alone.
    if (input.amountPaidMinor > 0 && input.current !== 'review') {
      return {
        kind: 'escalate',
        reason: 'unapplicable_money_observation',
        freezesOrder: false,
      };
    }
    return { kind: 'hold' };
  }

  if (isTerminalAttemptState(effective)) {
    return {
      kind: 'settle',
      state: effective,
      watch: terminalWatchFollowUp({
        nowMs: input.nowMs,
        settledAtMs: input.settledAtMs ?? input.nowMs,
        random,
      }),
    };
  }

  return {
    kind: 'advance',
    state: effective,
    followUp: retryFollowUp({
      nowMs: input.nowMs,
      startedAtMs: input.createdAtMs,
      random,
    }),
  };
}
