/**
 * Guest draft tokens kept in the browser (RIN-1447). A signed-out visitor's quiz from
 * their own PDF is readable only with this token; the server stores just its hash.
 * The token never goes to analytics, logs or URLs. No zod here: like `guest-claims`,
 * this module loads with the app layout (RIN-1370).
 */

import { setPendingClaimCookie } from '@/features/quiz/lib/guest-claims';

/** @public Tests and the e2e read the raw entry. */
export const GUEST_DRAFTS_STORAGE_KEY = 'rinkuzu.guestDrafts.v1';

const GUEST_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const GUEST_DRAFTS_MAX_ENTRIES = 5;

/** @public */
export interface GuestDraftClaim {
  token: string;
  /** Epoch milliseconds of the upload. */
  createdAt: number;
}

function isGuestDraftClaim(value: unknown): value is GuestDraftClaim {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<keyof GuestDraftClaim, unknown>;
  return typeof entry.token === 'string' && typeof entry.createdAt === 'number';
}

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // Storage disabled (privacy mode, blocked cookies).
    return null;
  }
}

/** Drafts younger than 24 h; anything unreadable counts as none. */
export function readGuestDraftClaims(now: number = Date.now()): GuestDraftClaim[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(GUEST_DRAFTS_STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isGuestDraftClaim)
      .filter((claim) => now - claim.createdAt <= GUEST_DRAFT_MAX_AGE_MS);
  } catch {
    return [];
  }
}

/**
 * Store a draft token, newest first: drops stale entries and keeps at most 5.
 * @public The guest upload page (RIN-1448) writes here; this slice only reads.
 */
export function addGuestDraftClaim(claim: GuestDraftClaim, now: number = Date.now()): void {
  const storage = getStorage();
  if (!storage) return;
  const claims = [
    claim,
    ...readGuestDraftClaims(now).filter((existing) => existing.token !== claim.token),
  ].slice(0, GUEST_DRAFTS_MAX_ENTRIES);
  try {
    storage.setItem(GUEST_DRAFTS_STORAGE_KEY, JSON.stringify(claims));
    // Sign-in with a draft pending lands on the dashboard, not the starter (RIN-921).
    setPendingClaimCookie(GUEST_DRAFT_MAX_AGE_MS / 1000);
  } catch {
    // Quota or disabled storage: the draft stays a guest draft until it expires.
  }
}

/** After the sign-in claim: the server dropped anything it could not use, so forget all. */
export function clearGuestDraftClaims(): void {
  try {
    getStorage()?.removeItem(GUEST_DRAFTS_STORAGE_KEY);
  } catch {
    // Disabled storage: nothing was stored.
  }
}
