export const SUBSCRIPTION_STATUSES = [
  'pending',
  'completed',
  'failed',
  'cancelled',
  'expired',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const ADMIN_MUTABLE_SUBSCRIPTION_STATUSES = ['failed', 'cancelled', 'expired'] as const;
export type AdminMutableSubscriptionStatus = (typeof ADMIN_MUTABLE_SUBSCRIPTION_STATUSES)[number];
