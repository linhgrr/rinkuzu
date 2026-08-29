import mongoose, { Types, type ClientSession } from 'mongoose';
import connectDB from '@/lib/mongoose';
import { PaymentAttempt } from '@/models/Billing';
import type { BillingOrderView } from '@/interfaces/repositories/IBillingOrderRepository';
import type {
  AttemptLease,
  SettlementAttemptSnapshot,
} from '@/interfaces/repositories/IBillingSettlementRepository';
import { BillingDomainError } from '@/services/billing/billing-domain';
import { ATTEMPT_STATES } from '@/services/billing/domain/attempt-transition';
import {
  MONEY_ADJUSTMENT_TYPES,
  MONEY_ALLOCATIONS,
  type LedgerAdjustment,
} from '@/services/billing/domain/settlement-math';
import type {
  BillingOrderPersistenceRecord,
  ExternalMoneyAdjustmentPersistenceRecord,
  PaymentAttemptPersistenceRecord,
} from '@/repositories/types/BillingPersistence';

/**
 * The handful of things every billing adapter needs and none of them owns.
 *
 * This module exists so that splitting one oversized repository into several
 * narrow ones did not mean duplicating the identity checks and the stored-enum
 * narrowing five times, which is how two adapters end up disagreeing about what
 * a status string means.
 */

export function objectId(value: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new BillingDomainError('invalid_user', 'User identity is invalid', 401);
  }
  return new Types.ObjectId(value);
}

/**
 * Persistence is the only place a status string exists untyped. Refusing an
 * unknown one here keeps every state machine downstream total.
 */
export function assertStoredEnum<T extends string>(
  values: readonly T[],
  value: string,
  label: string,
): T {
  const match = values.find((candidate) => candidate === value);
  if (match === undefined) {
    throw new BillingDomainError(
      'billing_state_corrupt',
      `Stored ${label} "${value}" is not a known value`,
      500,
    );
  }
  return match;
}

export interface PlanDuration {
  durationUnit: 'month';
  durationValue: number;
}

export function parsePlanDuration(duration: string): PlanDuration {
  const match = /^P(\d+)M$/.exec(duration);
  if (!match?.[1]) {
    throw new BillingDomainError('unsupported_plan_duration', 'Plan duration is unsupported', 400);
  }
  return { durationUnit: 'month', durationValue: Number(match[1]) };
}

/**
 * The entitlement predicate, as a MongoDB expression.
 *
 * Both the arming of a fulfillment work item and the commit that grants it
 * carry this in their filter, so an order whose money came back matches
 * nothing and no separate read can go stale between the check and the write.
 *
 * `netPrincipalAmount` is absent on rows written before it existed; for an
 * order with no adjustments it is exactly `receivedAmount`, which is what those
 * rows fall back to. The first settlement observation writes the field for
 * real, so the fallback narrows to legacy rows nothing has touched since.
 */
export const ENTITLED_ORDER_EXPRESSION = {
  $gte: [{ $ifNull: ['$netPrincipalAmount', '$receivedAmount'] }, '$finalAmount'],
} as const;

/** Narrows stored adjustment rows into the pure ledger the money algebra takes. */
export function toLedgerAdjustments(
  rows: readonly ExternalMoneyAdjustmentPersistenceRecord[],
): LedgerAdjustment[] {
  return rows.map((row) => ({
    type: assertStoredEnum(MONEY_ADJUSTMENT_TYPES, row.type, 'money adjustment type'),
    allocation: assertStoredEnum(MONEY_ALLOCATIONS, row.allocation, 'money allocation'),
    amountMinor: row.amount,
  }));
}

export function settlementAttemptSnapshot(
  attempt: PaymentAttemptPersistenceRecord,
  lease: AttemptLease | null = null,
): SettlementAttemptSnapshot {
  return {
    lease,
    attemptRef: attempt._id.toString(),
    orderRef: attempt.order.toString(),
    providerAccountId: attempt.providerAccountId,
    environment: attempt.environment,
    externalOrderId: attempt.externalOrderId ?? '',
    paymentLinkId: attempt.paymentLinkId ?? null,
    currency: attempt.currency,
    requestedAmountMinor: attempt.requestedAmount,
    collectionStatus: assertStoredEnum(ATTEMPT_STATES, attempt.collectionStatus, 'attempt status'),
    activeForCheckout: attempt.activeForCheckout,
    expiresAtMs: attempt.expiresAt.getTime(),
    settledAtMs: attempt.terminalConfirmedAt?.getTime() ?? null,
    createdAtMs: attempt.createdAt.getTime(),
    version: attempt.version,
  };
}

export function requireCreatedObjectId(value: Types.ObjectId | null): Types.ObjectId {
  if (!value) {
    throw new BillingDomainError('payment_processing_failed', 'Order was not created', 500);
  }
  return value;
}

export type BillingTransactionWork<T> = (session: ClientSession) => Promise<T>;

export async function runBillingTransaction<T>(work: BillingTransactionWork<T>): Promise<T> {
  await connectDB();
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(work);
  } finally {
    await session.endSession();
  }
}

/**
 * The customer-facing projection of an order. A checkout link dies at the
 * deadline the provider was given, which can be well before reconciliation
 * notices, so the URL is withheld once it has passed rather than sending
 * someone to a dead payment page.
 */
export async function toOrderView(order: BillingOrderPersistenceRecord): Promise<BillingOrderView> {
  const latestAttempt = await PaymentAttempt.findOne({ order: order._id })
    .sort({ createdAt: -1 })
    .lean<PaymentAttemptPersistenceRecord>()
    .exec();
  const activeAttempt = latestAttempt?.activeForCheckout ? latestAttempt : null;
  const liveAttempt =
    activeAttempt && activeAttempt.expiresAt.getTime() > Date.now() ? activeAttempt : null;
  return {
    id: order.publicId,
    plan: { id: order.planId, name: order.planName },
    currency: order.currency,
    baseAmount: order.baseAmount,
    discountAmount: order.discountAmount,
    finalAmount: order.finalAmount,
    receivedAmount: order.receivedAmount,
    excessAmount: order.excessAmount,
    excessResolution: order.excessResolution,
    collectionStatus: order.collectionStatus,
    ...(latestAttempt ? { attemptCollectionStatus: latestAttempt.collectionStatus } : {}),
    fulfillmentStatus: order.fulfillmentStatus,
    settlementStatus: order.settlementStatus,
    ...(liveAttempt?.checkoutUrl ? { checkoutUrl: liveAttempt.checkoutUrl } : {}),
    ...(activeAttempt ? { activeAttemptId: activeAttempt._id.toString() } : {}),
    ...(activeAttempt ? { attemptExpiresAt: activeAttempt.expiresAt.toISOString() } : {}),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
