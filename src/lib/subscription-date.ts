export interface SubscriptionExpiryInput {
  endDate?: Date | string | null;
}

export interface ActiveSubscriptionPremiumInput {
  isActive?: boolean | null;
  endDate?: Date | string | null;
}

/**
 * Fail-closed premium gate used by entitlement and payment blockers.
 * True only when the snapshot is active and has a valid endDate strictly after now.
 * Missing, null, or invalid endDate → false.
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
