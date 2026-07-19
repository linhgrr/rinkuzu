/**
 * Active-admin invariant: after every successful admin role/status mutation,
 * at least one user must match role `admin` and disable numeric `0`.
 *
 * Runtime serializes mutations via a singleton fence document; it never
 * bootstraps a missing fence (migration-only create).
 */

export const ACTIVE_ADMIN_FENCE_ID = 'active-admin' as const;

/** Exact active-admin filter for invariant counts and actor checks. */
export const ACTIVE_ADMIN_FILTER = {
  role: 'admin' as const,
  disable: 0 as const,
};

/**
 * Stable internal error codes for ServiceResult / API envelopes.
 * Kept in parity with both FE/BE contracts/api-error-codes.json files.
 */
export const ADMIN_INVARIANT_ERROR_CODE = {
  LAST_ACTIVE_ADMIN: 'last_active_admin',
  ADMIN_INVARIANT_UNAVAILABLE: 'admin_invariant_unavailable',
} as const;
