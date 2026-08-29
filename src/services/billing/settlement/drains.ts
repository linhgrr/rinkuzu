import { logger } from '@/lib/logger';
import type { InboxClaim, OrderRef } from '@/interfaces/repositories/IBillingSettlementRepository';
import {
  ATTEMPT_LEASE_MS,
  retryFollowUp,
  INBOX_LEASE_MS,
  isInboxExhausted,
} from '../domain/schedule';
import { fulfillOrder, type FulfillOrderResult } from './fulfill-order';
import { deferUnsettledAttempt, settleAttempt, type SettlementDeps } from './settle-attempt';

/**
 * The background drains. Each one is a bounded batch: the scheduler runs on a
 * serverless function with a hard timeout, and a batch killed mid-flight burns
 * attempt counts toward a dead-letter threshold for work that was never
 * actually tried.
 *
 * Nothing is claimed before the tick is ready to work on it. Claiming a whole
 * batch up front and then stopping at the budget left every row the tick never
 * reached leased — held out of the queue, for the full lease, by a worker that
 * had already gone home.
 *
 * Every item is isolated. One item that throws is recorded and skipped, never
 * allowed to abort the batch, because a single unprocessable item that stops
 * the loop is a permanent head-of-line block on every item behind it.
 */

export const DEFAULT_BATCH_LIMIT = 25;
export const DEFAULT_BATCH_BUDGET_MS = 45_000;
/**
 * The share of a combined tick that the inbox drain may not spend, so that the
 * fulfillment backlog is served even while webhooks arrive faster than they
 * can be drained. A third leaves the inbox the larger share — it is the queue
 * with the provider round trip — while keeping fulfillment's floor well above
 * the cost of a single order.
 */
export const FULFILLMENT_BUDGET_RESERVE = 1 / 3;
/**
 * The tail of a reconcile tick kept back for the alert sweep that follows it.
 *
 * The sweep shares the request's wall clock with the drain ahead of it, and a
 * drain allowed to spend the whole batch budget leaves the sweep to finish
 * inside whatever the platform has not yet reclaimed. The alerts that go
 * unsent in that case are exactly the ones a saturated tick is evidence for,
 * so the queue that reports trouble must not be starved by the trouble.
 */
export const ALERT_SWEEP_BUDGET_MS = 10_000;
/** Reserve for the one provider round trip each settlement makes. */
const PROVIDER_CALL_BUDGET_MS = 16_000;

export interface DrainOptions {
  limit?: number;
  budgetMs?: number;
}

export interface InboxDrainResult {
  claimed: number;
  processed: number;
  exhaustedBudget: boolean;
}

export interface AttemptDrainResult {
  processed: number;
  failed: number;
  exhaustedBudget: boolean;
}

export interface FulfillmentDrainResult {
  claimed: number;
  granted: number;
  exhaustedBudget: boolean;
}

function errorMessage(error: unknown, fallback: string): string {
  return (error instanceof Error ? error.message : fallback).slice(0, 1_000);
}

async function rescheduleInboxEvent(
  deps: SettlementDeps,
  claim: InboxClaim,
  status: 'orphaned' | 'retryable_failure',
  lastError: string | null,
): Promise<void> {
  const nowMs = deps.clock();
  const exhausted = isInboxExhausted({
    nowMs,
    createdAtMs: claim.createdAtMs,
    attemptCount: claim.attemptCount,
  });
  const followUp = retryFollowUp({
    nowMs,
    startedAtMs: claim.createdAtMs,
    random: deps.random,
  });
  const outcome = await deps.settlement.inInboxTransaction((tx) =>
    tx.reschedule({
      lease: claim.lease,
      status: exhausted ? 'dead_letter' : status,
      nextAttemptAtMs: followUp.atMs,
      lastError,
    }),
  );
  // A worker that no longer owns the row must not push it back out: another
  // worker has reclaimed it and its schedule is the live one now.
  if (outcome === 'lease_lost') {
    logger.warn({ inboxRef: claim.lease.inboxRef }, 'Inbox lease lost before reschedule');
  }
}

export async function drainWebhookInbox(
  deps: SettlementDeps,
  options: DrainOptions = {},
): Promise<InboxDrainResult> {
  const limit = options.limit ?? DEFAULT_BATCH_LIMIT;
  const deadline = deps.clock() + (options.budgetMs ?? DEFAULT_BATCH_BUDGET_MS);
  let claimed = 0;
  let processed = 0;
  let exhaustedBudget = false;

  for (let index = 0; index < limit; index += 1) {
    if (deps.clock() + PROVIDER_CALL_BUDGET_MS > deadline) {
      exhaustedBudget = true;
      break;
    }
    const claim = await deps.settlement.inInboxTransaction((tx) =>
      tx.claim({ nowMs: deps.clock(), leaseMs: INBOX_LEASE_MS }),
    );
    if (claim === null) break;
    claimed += 1;
    try {
      if (claim.orderCode === null) throw new Error('Webhook has no order code');
      const attempt = await deps.settlement.loadAttemptByExternalOrderId(
        claim.orderCode.toString(),
      );
      if (attempt === null) {
        await rescheduleInboxEvent(deps, claim, 'orphaned', null);
        continue;
      }
      await settleAttempt(deps, { attempt, origin: 'webhook' });
      const completed = await deps.settlement.inInboxTransaction((tx) =>
        tx.markProcessed(claim.lease),
      );
      if (completed === 'applied') processed += 1;
    } catch (error) {
      await rescheduleInboxEvent(
        deps,
        claim,
        'retryable_failure',
        errorMessage(error, 'Inbox processing failed'),
      );
    }
  }

  return { claimed, processed, exhaustedBudget };
}

export async function drainDueAttempts(
  deps: SettlementDeps,
  options: DrainOptions = {},
): Promise<AttemptDrainResult> {
  const limit = options.limit ?? DEFAULT_BATCH_LIMIT;
  const deadline = deps.clock() + (options.budgetMs ?? DEFAULT_BATCH_BUDGET_MS);
  let processed = 0;
  let failed = 0;
  let exhaustedBudget = false;

  for (let index = 0; index < limit; index += 1) {
    if (deps.clock() + PROVIDER_CALL_BUDGET_MS > deadline) {
      exhaustedBudget = true;
      break;
    }
    // Claimed one at a time, and only once there is budget to work on it, so
    // the queue never holds a lease on work this tick will not do.
    const attempt = await deps.settlement.claimNextDueAttempt({
      nowMs: deps.clock(),
      leaseMs: ATTEMPT_LEASE_MS,
    });
    if (attempt === null) break;
    try {
      await settleAttempt(deps, { attempt, origin: 'reconcile_cron' });
      processed += 1;
    } catch (error) {
      failed += 1;
      // Settlement threw before it wrote anything, so without this the same
      // attempt is selected first every tick and nothing behind it ever runs.
      const nowMs = deps.clock();
      const lease = attempt.lease;
      if (lease === null) continue;
      await deps.settlement.inSettlementTransaction((tx) =>
        deferUnsettledAttempt(tx, {
          attempt,
          lease,
          nowMs,
          random: deps.random,
          lastProviderError: errorMessage(error, 'Attempt reconciliation failed'),
        }),
      );
    }
  }

  return { processed, failed, exhaustedBudget };
}

export async function drainFulfillmentBacklog(
  deps: SettlementDeps,
  options: DrainOptions = {},
): Promise<FulfillmentDrainResult> {
  const limit = options.limit ?? DEFAULT_BATCH_LIMIT;
  const deadline = deps.clock() + (options.budgetMs ?? DEFAULT_BATCH_BUDGET_MS);
  const due = await deps.settlement.listDueFulfillments({ nowMs: deps.clock(), limit });
  let claimed = 0;
  let granted = 0;
  let exhaustedBudget = false;

  for (const order of due) {
    // Fulfillment is database-only, so no provider reserve is needed here.
    if (deps.clock() > deadline) {
      exhaustedBudget = true;
      break;
    }
    const result = await fulfillOrderSafely(deps, order.orderRef);
    // A row that was due when it was listed can be gone by the time it is
    // reached. Counting it as claimed would report work that never happened.
    if (result === null || result.outcome === 'not_claimable') continue;
    claimed += 1;
    if (result.outcome === 'granted') granted += 1;
  }

  return { claimed, granted, exhaustedBudget };
}

/**
 * One order that cannot even record its own failure must not take the batch
 * down with it; its lease expires and the next drain picks it up again.
 */
async function fulfillOrderSafely(
  deps: SettlementDeps,
  orderRef: OrderRef,
): Promise<FulfillOrderResult | null> {
  try {
    return await fulfillOrder(deps, orderRef);
  } catch (error) {
    logger.error({ err: error, orderRef }, 'Fulfillment failed and could not record its own state');
    return null;
  }
}
