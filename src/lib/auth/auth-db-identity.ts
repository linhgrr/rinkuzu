/**
 * Selects the durable Mongo account id for Auth.js session/JWT claims.
 *
 * Auth.js core intentionally overwrites `user.id` with `crypto.randomUUID()`
 * after the OAuth `profile()` callback while keeping custom profile fields
 * (see installed `@auth/core` `getUserAndAccount`). Google therefore carries
 * the real DB id on `dbUserId`; credentials keep the repository id on `user.id`.
 */
export type AuthIdentityProvider = 'google' | 'credentials' | (string & {});

export interface AuthIdentityUserLike {
  id?: unknown;
  dbUserId?: unknown;
}

function isNonEmptyId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Google requires a nonempty `dbUserId`. Credentials require a nonempty `user.id`.
 * Returns null when the provider-specific identity is missing (fail closed).
 */
export function selectAuthDbUserId(
  provider: AuthIdentityProvider | undefined,
  user: AuthIdentityUserLike | null | undefined,
): string | null {
  if (!user) return null;

  if (provider === 'google') {
    return isNonEmptyId(user.dbUserId) ? user.dbUserId.trim() : null;
  }

  // Credentials and any non-Google provider that already set repository `id`.
  return isNonEmptyId(user.id) ? user.id.trim() : null;
}
