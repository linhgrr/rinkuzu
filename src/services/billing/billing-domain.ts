import crypto from 'crypto';

const PROMO_CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/;
/**
 * PayOS refuses anything smaller, so a plan priced below this can be quoted but
 * never paid for. Exported so plan validation and discount maths cannot drift.
 */
export const VND_MINIMUM_PAYABLE = 2_000;

export class BillingDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = 'BillingDomainError';
  }
}

export function normalizePromoCode(value: string): string {
  const normalized = value.trim().normalize('NFKC').toUpperCase();
  if (!PROMO_CODE_PATTERN.test(normalized)) {
    throw new BillingDomainError('promo_not_applicable', 'Promo code is not applicable', 400);
  }
  return normalized;
}

export type PromotionRule =
  | {
      kind: 'percentage';
      percentageOff: number;
      percentageCap?: number;
      minimumSubtotal: number;
    }
  | {
      kind: 'fixed';
      fixedAmount: number;
      minimumSubtotal: number;
    };

export interface DiscountResult {
  discountAmount: number;
  finalAmount: number;
}

export function calculateDiscount(subtotal: number, rule: PromotionRule): DiscountResult {
  if (!Number.isSafeInteger(subtotal) || subtotal < VND_MINIMUM_PAYABLE) {
    throw new BillingDomainError('invalid_price', 'Subtotal is not payable', 400);
  }
  if (subtotal < rule.minimumSubtotal) {
    throw new BillingDomainError(
      'promo_not_eligible_for_plan',
      'Promo code is not eligible for this plan',
    );
  }

  const discountAmount =
    rule.kind === 'fixed'
      ? rule.fixedAmount
      : Math.min(
          Math.floor((subtotal * rule.percentageOff) / 100),
          rule.percentageCap ?? Number.MAX_SAFE_INTEGER,
        );
  const finalAmount = subtotal - discountAmount;

  if (
    !Number.isSafeInteger(discountAmount) ||
    discountAmount < 0 ||
    finalAmount < VND_MINIMUM_PAYABLE
  ) {
    throw new BillingDomainError(
      'promo_not_eligible_for_plan',
      'Promo code is not eligible for this plan',
    );
  }
  return { discountAmount, finalAmount };
}

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalizeValue(nested)]),
    );
  }
  return typeof value === 'string' ? value.normalize('NFKC') : value;
}

export interface IdempotencyHashInput {
  endpoint: string;
  apiVersion: string;
  payload: Record<string, unknown>;
}

export function hashIdempotencyRequest(input: IdempotencyHashInput): string {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify(
        canonicalizeValue({
          apiVersion: input.apiVersion,
          endpoint: input.endpoint,
          payload: input.payload,
        }),
      ),
    )
    .digest('hex');
}

export function addCalendarMonths(start: Date, months: number, anchorDay: number): Date {
  const result = new Date(start);
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(anchorDay, lastDay));
  return result;
}

export type ReplayGrant = {
  id: string;
  sequence: number;
  segmentId: string;
  segmentBaselineStartAt: Date;
  segmentAnchorDay: number;
  durationUnit: 'day' | 'month' | 'perpetual';
  durationValue?: number;
};

export type ReplayAdjustment = {
  sequence: number;
  grantId: string;
  type: 'revoke' | 'restore';
};

export type EntitlementProjection = {
  startAt: Date | null;
  endAt: Date | null;
  perpetual: boolean;
};

export function replayEntitlement(
  grants: ReplayGrant[],
  adjustments: ReplayAdjustment[],
): EntitlementProjection {
  const effective = new Map<string, boolean>();
  for (const grant of grants) effective.set(grant.id, true);
  for (const adjustment of [...adjustments].sort((a, b) => a.sequence - b.sequence)) {
    effective.set(adjustment.grantId, adjustment.type === 'restore');
  }

  let latest: EntitlementProjection = { startAt: null, endAt: null, perpetual: false };
  const segments = Map.groupBy(
    [...grants]
      .filter((grant) => effective.get(grant.id) === true)
      .sort((a, b) => a.sequence - b.sequence),
    (grant) => grant.segmentId,
  );

  for (const segmentGrants of segments.values()) {
    const first = segmentGrants[0];
    if (!first) continue;
    let cursor = new Date(first.segmentBaselineStartAt);
    let perpetual = false;
    for (const grant of segmentGrants) {
      if (grant.durationUnit === 'perpetual') {
        perpetual = true;
        break;
      }
      const value = grant.durationValue;
      if (!value || value < 1) {
        throw new BillingDomainError('invalid_entitlement_grant', 'Invalid entitlement duration');
      }
      cursor =
        grant.durationUnit === 'month'
          ? addCalendarMonths(cursor, value, first.segmentAnchorDay)
          : new Date(cursor.getTime() + value * 86_400_000);
    }

    if (
      latest.startAt === null ||
      perpetual ||
      (latest.endAt !== null && cursor.getTime() > latest.endAt.getTime())
    ) {
      latest = {
        startAt: new Date(first.segmentBaselineStartAt),
        endAt: perpetual ? null : cursor,
        perpetual,
      };
    }
  }

  return latest;
}

const COLLECTION_RANK: Record<string, number> = {
  creating: 0,
  pending: 1,
  partial: 2,
  cancelled: 3,
  expired: 3,
  failed: 3,
  review: 4,
  paid: 5,
};

/** Internal ladder. Callers go through `resolveCollectionTransition`, which
 * also decides what to do when the ladder refuses a transition. */
function canApplyCollectionTransition(current: string, next: string): boolean {
  if (current === next) return true;
  if (next === 'paid') return true;
  if (current === 'paid') return false;
  if (current === 'review') return next === 'paid';
  return (COLLECTION_RANK[next] ?? -1) >= (COLLECTION_RANK[current] ?? -1);
}

/**
 * Resolves what an attempt's collection status should become after observing
 * the provider, or null when there is nothing to apply.
 *
 * The rank ladder alone would silently drop money: a part payment landing on an
 * attempt we already cancelled or expired ranks *below* the current status, so
 * the transition is refused and the order's received amount is never refreshed.
 * Observed money is never a no-op — it either advances the attempt or becomes an
 * operator discrepancy.
 */
export function resolveCollectionTransition(
  current: string,
  observed: string,
  amountPaid: number,
): string | null {
  if (canApplyCollectionTransition(current, observed)) return observed;
  if (amountPaid > 0 && current !== 'review') return 'review';
  return null;
}

/**
 * True when an attempt's own deadline has passed with no money against it.
 *
 * `expiresAt` is a local fact recorded when the checkout link was created and
 * handed to the provider as `expiredAt`. Closing the attempt on that deadline
 * instead of waiting for the provider to agree unblocks the replacement-attempt
 * path and releases the promo reservation. Money always wins over the deadline:
 * a paid transition is still accepted afterwards.
 */
export interface LocalExpiryInput {
  observed: string;
  amountPaid: number;
  expiresAt: Date;
  now?: number;
}

export function isLocallyExpiredAttempt(input: LocalExpiryInput): boolean {
  return (
    input.amountPaid === 0 &&
    input.expiresAt.getTime() < (input.now ?? Date.now()) &&
    ['creating', 'pending'].includes(input.observed)
  );
}

export function reconciliationDelayMs(ageMs: number): number {
  if (ageMs < 15 * 60_000) return 60_000;
  if (ageMs < 60 * 60_000) return 5 * 60_000;
  if (ageMs < 24 * 60 * 60_000) return 30 * 60_000;
  return 6 * 60 * 60_000;
}

export function withJitter(valueMs: number, random = Math.random): number {
  return Math.max(1_000, Math.round(valueMs * (0.8 + random() * 0.4)));
}
