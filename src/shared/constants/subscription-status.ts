export const SUBSCRIPTION_STATUSES = [
  'pending',
  'completed',
  'failed',
  'cancelled',
  'expired',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * Entitlement status is derived from the projection window, never stored, so
 * these are the only two values a subscription row can ever report. Filtering
 * by anything else can only return nothing, so the admin surface must not
 * offer it.
 */
export const DERIVED_SUBSCRIPTION_STATUSES = ['completed', 'expired'] as const;
export type DerivedSubscriptionStatus = (typeof DERIVED_SUBSCRIPTION_STATUSES)[number];
