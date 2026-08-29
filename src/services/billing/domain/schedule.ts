import { BillingDomainError } from '../billing-domain';

/**
 * Scheduling policy for every piece of billing background work: attempt
 * reconciliation, webhook inbox retries, fulfillment retries and the bounded
 * late-money watch on settled attempts.
 *
 * Everything here is pure. `nowMs` is always passed in and randomness is always
 * injected, so a test can pin a schedule exactly instead of asserting on a
 * range.
 */

/** How long a claimed webhook inbox row stays leased to one worker. */
export const INBOX_LEASE_MS = 60_000;

/** How long a claimed paid-unfulfilled order stays leased to one worker. */
export const FULFILLMENT_LEASE_MS = 60_000;

/**
 * How long a claimed payment attempt stays leased to one drain.
 *
 * This is a queue claim and nothing more: the transitions it leads to are
 * fenced by the attempt's own version. Its only job is to stop two overlapping
 * ticks from each making the same provider call for the same attempt, so it
 * only has to outlive one settlement round trip.
 */
export const ATTEMPT_LEASE_MS = 120_000;

/** Retry attempts after which an inbox row stops being retried. */
const INBOX_MAX_ATTEMPTS = 50;

/** Age after which an inbox row stops being retried regardless of attempts. */
const INBOX_MAX_AGE_MS = 7 * 86_400_000;

/**
 * How long automation keeps failing on the same attempt before an operator has
 * to look at it. A day of provider failures is no longer a transient blip.
 */
const ATTEMPT_STALL_MS = 24 * 60 * 60_000;

/**
 * A settled attempt is still watched, rarely and for a bounded window, because
 * a provider can report money after we closed the attempt locally. Without the
 * horizon this would be an unbounded growing scan; without the watch, late
 * money would never be observed at all.
 */
const TERMINAL_WATCH_INTERVAL_MS = 6 * 60 * 60_000;
const TERMINAL_WATCH_HORIZON_MS = 7 * 86_400_000;

/**
 * A due time that is strictly after the `nowMs` it was derived from.
 *
 * The private field makes this nominal: the only way to obtain one is
 * `FollowUp.in`, which refuses a non-positive delay. Transitions that must keep
 * work moving take a `FollowUp` rather than a `Date`, so "forgot to reschedule"
 * and "rescheduled into the past" both become compile-time or construction-time
 * failures instead of a silently starved queue.
 */
export class FollowUp {
  private constructor(
    readonly atMs: number,
    readonly delayMs: number,
  ) {}

  static in(nowMs: number, delayMs: number): FollowUp {
    if (!Number.isSafeInteger(nowMs) || !Number.isSafeInteger(delayMs) || delayMs <= 0) {
      throw new BillingDomainError(
        'invalid_schedule',
        'Background work must be rescheduled strictly into the future',
        500,
      );
    }
    return new FollowUp(nowMs + delayMs, delayMs);
  }
}

/**
 * Backoff ladder keyed on how long the work item has already existed. Fresh
 * items are chased hard because a customer is usually waiting; old ones settle
 * into a cheap heartbeat.
 */
export function reconciliationDelayMs(ageMs: number): number {
  if (ageMs < 15 * 60_000) return 60_000;
  if (ageMs < 60 * 60_000) return 5 * 60_000;
  if (ageMs < 24 * 60 * 60_000) return 30 * 60_000;
  return 6 * 60 * 60_000;
}

/** Spreads a fleet of workers so they do not all wake on the same second. */
export function withJitter(valueMs: number, random: () => number = Math.random): number {
  return Math.max(1_000, Math.round(valueMs * (0.8 + random() * 0.4)));
}

export interface RetryScheduleInput {
  /** Current wall clock in epoch milliseconds. */
  readonly nowMs: number;
  /** When the work item first appeared, in epoch milliseconds. */
  readonly startedAtMs: number;
  readonly random: () => number;
}

/** The next check for a work item that is still open. */
export function retryFollowUp(input: RetryScheduleInput): FollowUp {
  const delay = withJitter(reconciliationDelayMs(input.nowMs - input.startedAtMs), input.random);
  return FollowUp.in(input.nowMs, delay);
}

export interface TerminalWatchInput {
  readonly nowMs: number;
  /** When the attempt was confirmed terminal, in epoch milliseconds. */
  readonly settledAtMs: number;
  readonly random: () => number;
}

/**
 * The next low-frequency check for a settled attempt, or `null` once the watch
 * horizon has passed and the attempt should stop being selected at all.
 */
export function terminalWatchFollowUp(input: TerminalWatchInput): FollowUp | null {
  if (input.nowMs - input.settledAtMs >= TERMINAL_WATCH_HORIZON_MS) return null;
  const delay = withJitter(TERMINAL_WATCH_INTERVAL_MS, input.random);
  return FollowUp.in(input.nowMs, delay);
}

/**
 * How long an order parked as awaiting manual activation waits before it is
 * looked at again. Deferral is not a fulfillment attempt, so the order keeps a
 * due time instead of leaving the queue: an operator who switches automatic
 * activation back on gets the parked backlog drained without re-arming it by
 * hand, and the interval is long enough that a parked backlog can never become
 * a hot loop.
 */
const MANUAL_ACTIVATION_RECHECK_MS = 60 * 60_000;

export function manualActivationFollowUp(nowMs: number, random: () => number): FollowUp {
  return FollowUp.in(nowMs, withJitter(MANUAL_ACTIVATION_RECHECK_MS, random));
}

export interface InboxExhaustionInput {
  readonly nowMs: number;
  readonly createdAtMs: number;
  readonly attemptCount: number;
}

/** True when an inbox row has been retried long enough to be dead-lettered. */
export function isInboxExhausted(input: InboxExhaustionInput): boolean {
  return (
    input.attemptCount >= INBOX_MAX_ATTEMPTS || input.nowMs - input.createdAtMs >= INBOX_MAX_AGE_MS
  );
}

export interface StallInput {
  readonly nowMs: number;
  readonly startedAtMs: number;
}

/** True when automation has been failing on one item long enough to escalate. */
export function isStalled(input: StallInput): boolean {
  return input.nowMs - input.startedAtMs >= ATTEMPT_STALL_MS;
}
