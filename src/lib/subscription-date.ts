export interface SubscriptionExpiryInput {
  endDate?: Date | string | null;
}

export function isSubscriptionExpired(
  subscription: SubscriptionExpiryInput,
  now: Date = new Date(),
): boolean {
  if (subscription.endDate == null) return false;

  const endTimestamp = new Date(subscription.endDate).getTime();
  return !Number.isFinite(endTimestamp) || endTimestamp <= now.getTime();
}
