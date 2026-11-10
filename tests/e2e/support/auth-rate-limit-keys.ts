/**
 * Every E2E credentials login comes from the loopback address, so the
 * 20-per-15-minutes `credentials_ip` limit (src/lib/auth-rate-limit.ts) is
 * shared by every spec in a shard. A serial run of the whole suite spends it
 * before the later admin logins (PR #387, RIN-1389). Specs that sign in clear
 * these keys before they seed and again when they clean up.
 */
export const E2E_CREDENTIAL_IP_RATE_LIMIT_KEYS = [
  'auth:credentials_ip:127.0.0.1',
  'auth:credentials_ip:::1',
  'auth:credentials_ip:unknown',
] as const;
