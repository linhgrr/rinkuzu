import { z } from 'zod';

/**
 * Guest claim token (RIN-912): 32 random bytes from the browser, base64url without padding.
 * Client-safe (no node:crypto); the server hashes it in `@/lib/guest-claim-token`.
 */
export { GUEST_CLAIM_TOKEN_HEADER } from './guest-claim-token-header';

export const guestClaimTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, 'Guest claim token is invalid');
