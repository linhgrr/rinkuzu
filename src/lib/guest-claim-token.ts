import { createHash } from 'node:crypto';

/**
 * Only the SHA-256 hex digest of a guest claim token is stored on an attempt (RIN-912).
 * Never log the token or the hash.
 */
export function hashGuestClaimToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
