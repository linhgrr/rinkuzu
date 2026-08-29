import { FollowUp, retryFollowUp } from './schedule';

/**
 * Fulfillment is the second of two durable commits. The first one records the
 * money and leaves the order in a leased paid-unfulfilled state; this module
 * decides what the fulfillment worker does with that state.
 *
 * Fulfillment turns on net settlement, not on how much the provider collected.
 * An order whose payment was refunded or charged back before the worker got to
 * it has collected the full amount and is owed nothing, and keying the decision
 * off the collection status granted it Premium anyway. `entitled` is
 * `netPrincipal >= finalAmount` — the same figure the settlement ledger derives
 * — so a refund before fulfillment withholds the grant, and a merchant credit
 * that makes an underpaid order whole earns one.
 *
 * The rule that shapes everything here: money already observed stays committed.
 * An entitlement conflict we expect (the user already owns a perpetual grant, a
 * replay ran out of room) is not a reason to roll the money back — it moves
 * fulfillment to operator review with a reason and leaves the payment alone.
 * Anything unexpected is treated as transient and rescheduled, so one poisoned
 * order can never hold up the ones behind it.
 */

export const FULFILLMENT_STATES = [
  'unfulfilled',
  'processing',
  'fulfilled',
  'revoked',
  'review',
] as const;
export type FulfillmentState = (typeof FULFILLMENT_STATES)[number];

/**
 * How many failed fulfillment attempts an order gets before an operator has to
 * look at it. The count includes the attempt currently failing, so the tenth
 * failure is the one that stops the retries.
 */
const MAX_FULFILLMENT_ATTEMPTS = 10;

/**
 * Entitlement errors that are an expected outcome of a legitimate payment
 * rather than a bug or an outage.
 */
const ENTITLEMENT_CONFLICT_CODES = [
  'already_has_perpetual_entitlement',
  'entitlement_replay_limit',
] as const;
type EntitlementConflictCode = (typeof ENTITLEMENT_CONFLICT_CODES)[number];

/** Why fulfillment stopped and handed the order to an operator. */
export type FulfillmentReviewReason = EntitlementConflictCode | 'fulfillment_attempts_exhausted';

type FulfillmentSkipReason = 'not_entitled' | 'already_fulfilled' | 'operator_owned';

interface FulfillmentGrant {
  readonly kind: 'grant';
}

interface FulfillmentSkip {
  readonly kind: 'skip';
  readonly reason: FulfillmentSkipReason;
}

/**
 * Automatic activation is switched off, so the money is parked as awaiting
 * manual activation instead of granting anything.
 */
interface FulfillmentDefer {
  readonly kind: 'defer';
}

export type FulfillmentDecision = FulfillmentGrant | FulfillmentSkip | FulfillmentDefer;

export interface FulfillmentInput {
  /**
   * Whether the order's net settlement covers what it is owed. Derived from the
   * whole money ledger — payments and every external adjustment — so a refund
   * or chargeback that landed before the worker did withholds the grant.
   */
  readonly entitled: boolean;
  /** An order an operator has taken over is not automation's to fulfil. */
  readonly collectionUnderReview: boolean;
  readonly fulfillment: FulfillmentState;
  readonly autoActivationEnabled: boolean;
}

export function decideFulfillment(input: FulfillmentInput): FulfillmentDecision {
  if (input.collectionUnderReview) return { kind: 'skip', reason: 'operator_owned' };
  if (!input.entitled) return { kind: 'skip', reason: 'not_entitled' };
  if (input.fulfillment === 'fulfilled' || input.fulfillment === 'revoked') {
    return { kind: 'skip', reason: 'already_fulfilled' };
  }
  if (input.fulfillment === 'review') {
    return { kind: 'skip', reason: 'operator_owned' };
  }
  if (!input.autoActivationEnabled) return { kind: 'defer' };
  return { kind: 'grant' };
}

interface FulfillmentReviewOutcome {
  readonly kind: 'review';
  readonly reason: FulfillmentReviewReason;
}

interface FulfillmentRetryOutcome {
  readonly kind: 'retry';
  readonly followUp: FollowUp;
}

export type FulfillmentFailureOutcome = FulfillmentReviewOutcome | FulfillmentRetryOutcome;

export interface FulfillmentFailureInput {
  /** The domain error code, or `null` for anything unclassified. */
  readonly code: string | null;
  /** Fulfillment attempts made on this order, the failing one included. */
  readonly attemptCount: number;
  readonly nowMs: number;
  /** When the order became payable, in epoch milliseconds; the backoff base. */
  readonly collectedAtMs: number;
  readonly random?: () => number;
}

function isEntitlementConflictCode(code: string | null): code is EntitlementConflictCode {
  return code !== null && (ENTITLEMENT_CONFLICT_CODES as readonly string[]).includes(code);
}

export function classifyFulfillmentFailure(
  input: FulfillmentFailureInput,
): FulfillmentFailureOutcome {
  if (isEntitlementConflictCode(input.code)) return { kind: 'review', reason: input.code };
  if (input.attemptCount >= MAX_FULFILLMENT_ATTEMPTS) {
    return { kind: 'review', reason: 'fulfillment_attempts_exhausted' };
  }
  return {
    kind: 'retry',
    followUp: retryFollowUp({
      nowMs: input.nowMs,
      startedAtMs: input.collectedAtMs,
      random: input.random ?? Math.random,
    }),
  };
}
