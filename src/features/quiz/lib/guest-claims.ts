/**
 * Guest claim tokens kept in the browser (RIN-912). A signed-out learner's attempt is
 * readable only with the token sent at submit; the server stores just its hash.
 * The token never goes to analytics, logs or URLs.
 */

import { z } from 'zod';

/** @public Read by the sign-in claim step (RIN-912 part 4). */
export const GUEST_CLAIMS_STORAGE_KEY = 'rinkuzu.guestClaims.v1';

const GUEST_CLAIM_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const GUEST_CLAIMS_MAX_ENTRIES = 10;
const TOKEN_BYTES = 32;

/** @public */
export interface GuestClaim {
  attemptId: string;
  token: string;
  quizSlug: string;
  /** Epoch milliseconds of the submit. */
  takenAt: number;
}

/** 32 random bytes, base64url without padding (43 chars), as the server's schema expects. */
export function createGuestClaimToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const guestClaimSchema = z.object({
  attemptId: z.string(),
  token: z.string(),
  quizSlug: z.string(),
  takenAt: z.number(),
});

function isGuestClaim(value: unknown): value is GuestClaim {
  return guestClaimSchema.safeParse(value).success;
}

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // Storage disabled (privacy mode, blocked cookies).
    return null;
  }
}

function isFresh(claim: GuestClaim, now: number): boolean {
  return now - claim.takenAt <= GUEST_CLAIM_MAX_AGE_MS;
}

/**
 * Claims younger than 24 h; anything unreadable counts as no claims.
 * @public Also read by the sign-in claim step (RIN-912 part 4).
 */
export function readGuestClaims(now: number = Date.now()): GuestClaim[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(GUEST_CLAIMS_STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isGuestClaim).filter((claim) => isFresh(claim, now));
  } catch {
    return [];
  }
}

/** Store a claim, newest first: drops stale entries and keeps at most 10. */
export function addGuestClaim(claim: GuestClaim, now: number = Date.now()): void {
  const storage = getStorage();
  if (!storage) return;
  const claims = [
    claim,
    ...readGuestClaims(now).filter((existing) => existing.attemptId !== claim.attemptId),
  ].slice(0, GUEST_CLAIMS_MAX_ENTRIES);
  try {
    storage.setItem(GUEST_CLAIMS_STORAGE_KEY, JSON.stringify(claims));
  } catch {
    // Quota or disabled storage: the result page falls back to the score in the URL.
  }
}

export function findGuestClaimToken(attemptId: string, now: number = Date.now()): string | null {
  return readGuestClaims(now).find((claim) => claim.attemptId === attemptId)?.token ?? null;
}
