export interface SubscriptionExpiryInput {
  endDate?: Date | string | null;
}

export interface ActiveSubscriptionPremiumInput {
  isActive?: boolean | null;
  endDate?: Date | string | null;
}

/**
 * Lifetime plans use a far-future endDate sentinel instead of a missing endDate.
 * This keeps every downstream check on a single rule ("active + not past
 * endDate") and makes a genuinely-missing endDate an unambiguous anomaly.
 */
export const LIFETIME_END_DATE = new Date('9999-12-31T23:59:59.999Z');

export function isLifetimeEndDate(endDate: Date | string | null | undefined): boolean {
  if (endDate == null) return false;
  return new Date(endDate).getTime() === LIFETIME_END_DATE.getTime();
}

/**
 * Fail-closed premium gate used by entitlement and payment blockers.
 * True only when the snapshot is active and has a valid endDate strictly after now.
 * Missing, null, or invalid endDate → false (lifetime plans use LIFETIME_END_DATE).
 *
 * Do not use this for expiry transitions — those still call isSubscriptionExpired,
 * which intentionally treats a missing endDate as not-yet-expired.
 */
export function isActiveSubscriptionPremium(
  subscription: ActiveSubscriptionPremiumInput | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!subscription) return false;
  if (subscription.isActive !== true) return false;
  if (subscription.endDate == null) return false;

  const endTimestamp = new Date(subscription.endDate).getTime();
  if (!Number.isFinite(endTimestamp)) return false;

  return endTimestamp > now.getTime();
}

export function isSubscriptionExpired(
  subscription: SubscriptionExpiryInput,
  now: Date = new Date(),
): boolean {
  if (subscription.endDate == null) return false;

  const endTimestamp = new Date(subscription.endDate).getTime();
  return !Number.isFinite(endTimestamp) || endTimestamp <= now.getTime();
}
