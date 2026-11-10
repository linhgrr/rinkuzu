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

/** @public Tests read the raw entry. */
export const CLAIMED_GUEST_DRAFT_STORAGE_KEY = 'rinkuzu.claimedGuestDraft.v1';

interface ClaimedGuestDraftQuiz {
  slug: string;
  /** Epoch milliseconds of the claim. */
  claimedAt: number;
}

function isClaimedGuestDraftQuiz(value: unknown): value is ClaimedGuestDraftQuiz {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<keyof ClaimedGuestDraftQuiz, unknown>;
  return typeof entry.slug === 'string' && typeof entry.claimedAt === 'number';
}

/**
 * The quiz the sign-in claim made from the newest draft (RIN-1485): the draft is gone,
 * so Retake on its result and the draft player open this quiz instead. A slug only.
 */
export function rememberClaimedGuestDraftQuiz(slug: string, now: number = Date.now()): void {
  try {
    getStorage()?.setItem(
      CLAIMED_GUEST_DRAFT_STORAGE_KEY,
      JSON.stringify({ slug, claimedAt: now } satisfies ClaimedGuestDraftQuiz),
    );
  } catch {
    // Quota or disabled storage: Retake shows the expired card with its library link.
  }
}

/** The claimed quiz's slug for 24 h after the claim, else null. */
export function readClaimedGuestDraftQuiz(now: number = Date.now()): string | null {
  try {
    const parsed: unknown = JSON.parse(
      getStorage()?.getItem(CLAIMED_GUEST_DRAFT_STORAGE_KEY) ?? 'null',
    );
    if (!isClaimedGuestDraftQuiz(parsed)) return null;
    return now - parsed.claimedAt <= GUEST_DRAFT_MAX_AGE_MS ? parsed.slug : null;
  } catch {
    return null;
  }
}
