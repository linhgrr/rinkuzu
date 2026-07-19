/** Canonical account soft-disable persistence contract: exact numeric enum only. */
export const ACCOUNT_DISABLE_ACTIVE = 0 as const;
export const ACCOUNT_DISABLE_DISABLED = 1 as const;

export type AccountDisableState = typeof ACCOUNT_DISABLE_ACTIVE | typeof ACCOUNT_DISABLE_DISABLED;

/** Exact-active filter for every normal auth, subscription, and eligibility read. */
export const ACTIVE_ACCOUNT_FILTER = {
  disable: ACCOUNT_DISABLE_ACTIVE,
} as const;

export function isAccountDisableState(value: unknown): value is AccountDisableState {
  return value === ACCOUNT_DISABLE_ACTIVE || value === ACCOUNT_DISABLE_DISABLED;
}

export function isAuthVersion(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
