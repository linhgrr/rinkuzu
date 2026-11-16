/**
 * Guest claim tokens kept in the browser (RIN-912). A signed-out learner's attempt is
 * readable only with the token sent at submit; the server stores just its hash.
 * The token never goes to analytics, logs or URLs.
 */

import { GUEST_CLAIM_PENDING_COOKIE } from '@/shared/constants/starter-quiz';

/** @public Tests and the e2e read the raw entry. */
export const GUEST_CLAIMS_STORAGE_KEY = 'rinkuzu.guestClaims.v1';

const HOUR_MS = 60 * 60 * 1000;
/** A quiz attempt stays claimable for 7 days (RIN-1710); the server window matches. */
const GUEST_CLAIM_MAX_AGE_MS = 7 * 24 * HOUR_MS;
/** A guest draft is deleted after 24 h (RIN-1448), so its attempt cannot be claimed later. */
const GUEST_DRAFT_CLAIM_MAX_AGE_MS = 24 * HOUR_MS;
const GUEST_CLAIM_MAX_AGE_SECONDS = GUEST_CLAIM_MAX_AGE_MS / 1000;
const GUEST_CLAIMS_MAX_ENTRIES = 10;
const TOKEN_BYTES = 32;

/** @public */
export interface GuestClaim {
  attemptId: string;
  token: string;
  quizSlug: string;
  /** Epoch milliseconds of the submit. */
  takenAt: number;
  /** An attempt on a guest draft: claimed with the draft, so it keeps the draft's 24 h. */
  kind?: 'draft';
  /** Rounded percent 0–100, for the resume banner (RIN-1710). */
  score?: number;
  /** Trimmed, at most 120 chars. */
  quizTitle?: string;
  /**
   * The guest tapped "Remind me with Google" on the result card for this attempt (RIN-1712):
   * the claim after sign-in also opts the learner in to the 2-day review email.
   */
  reviewOptIn?: boolean;
}

const QUIZ_TITLE_MAX = 120;

/** The optional `score` and `quizTitle` of a claim, ready to spread; empty when unusable. */
export function guestClaimDisplay(
  score: unknown,
  title: unknown,
): Pick<GuestClaim, 'score' | 'quizTitle'> {
  const out: Pick<GuestClaim, 'score' | 'quizTitle'> = {};
  if (typeof score === 'number' && Number.isFinite(score)) {
    out.score = Math.min(100, Math.max(0, Math.round(score)));
  }
  const trimmed = typeof title === 'string' ? title.trim().slice(0, QUIZ_TITLE_MAX).trim() : '';
  if (trimmed) out.quizTitle = trimmed;
  return out;
}

/** 32 random bytes, base64url without padding (43 chars), as the server's schema expects. */
export function createGuestClaimToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Plain guard instead of a zod schema: this module loads with the app layout (via
 * GuestAttemptClaimer), and one zod import put all of zod in every app route first-load
 * JS (RIN-1370).
 */
function isGuestClaim(value: unknown): value is GuestClaim {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<keyof GuestClaim, unknown>;
  return (
    typeof entry.attemptId === 'string' &&
    typeof entry.token === 'string' &&
    typeof entry.quizSlug === 'string' &&
    typeof entry.takenAt === 'number' &&
    (entry.kind === undefined || entry.kind === 'draft') &&
    (entry.score === undefined || typeof entry.score === 'number') &&
    (entry.quizTitle === undefined || typeof entry.quizTitle === 'string') &&
    (entry.reviewOptIn === undefined || typeof entry.reviewOptIn === 'boolean')
  );
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
  const maxAge = claim.kind === 'draft' ? GUEST_DRAFT_CLAIM_MAX_AGE_MS : GUEST_CLAIM_MAX_AGE_MS;
  return now - claim.takenAt <= maxAge;
}

/** Claims within their window (7 days, 24 h for a draft attempt); anything unreadable counts as no claims. */
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
    setPendingClaimCookie(GUEST_CLAIM_MAX_AGE_SECONDS);
  } catch {
    // Quota or disabled storage: the result page falls back to the score in the URL.
  }
}

/**
 * Mark this attempt's stored claim as a review-reminder opt-in (RIN-1712). It lives in the
 * claim entry, so it survives the Google flow falling back to email sign-in. No entry for
 * the attempt (another device, cleared storage) means nothing to mark.
 */
export function markGuestClaimReviewOptIn(attemptId: string, now: number = Date.now()): void {
  const storage = getStorage();
  if (!storage) return;
  const claims = readGuestClaims(now);
  if (!claims.some((claim) => claim.attemptId === attemptId)) return;
  try {
    storage.setItem(
      GUEST_CLAIMS_STORAGE_KEY,
      JSON.stringify(
        claims.map((claim) =>
          claim.attemptId === attemptId ? { ...claim, reviewOptIn: true } : claim,
        ),
      ),
    );
  } catch {
    // Quota or disabled storage: the claim still goes through, without the opt-in.
  }
}

export function findGuestClaimToken(attemptId: string, now: number = Date.now()): string | null {
  return readGuestClaims(now).find((claim) => claim.attemptId === attemptId)?.token ?? null;
}

/**
 * A value-free marker that `/start` reads: sign-in in a browser with a claim pending
 * is not a new learner, so it lands on the dashboard, not the starter (RIN-921).
 * It never carries the token or the attempt id.
 */
export function setPendingClaimCookie(maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${GUEST_CLAIM_PENDING_COOKIE}=1; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

/** After the sign-in claim: the server dropped anything it could not use, so forget all. */
export function clearGuestClaims(): void {
  try {
    getStorage()?.removeItem(GUEST_CLAIMS_STORAGE_KEY);
  } catch {
    // Disabled storage: nothing was stored.
  }
  setPendingClaimCookie(0);
}

/** @public Banner dismissals (RIN-1710): attempt id and when it was dismissed. */
export const GUEST_RESUME_DISMISSED_STORAGE_KEY = 'rinkuzu.guestResumeDismissed.v1';
const DISMISS_MAX_AGE_MS = 7 * 24 * HOUR_MS;
const DISMISS_MAX_ENTRIES = 10;

interface ResumeDismissal {
  attemptId: string;
  at: number;
}

function readDismissals(now: number): ResumeDismissal[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(GUEST_RESUME_DISMISSED_STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ResumeDismissal =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as ResumeDismissal).attemptId === 'string' &&
        typeof (item as ResumeDismissal).at === 'number' &&
        now - (item as ResumeDismissal).at <= DISMISS_MAX_AGE_MS,
    );
  } catch {
    return [];
  }
}

export interface ResumeBannerClaim {
  latest: GuestClaim;
  others: number;
  ageHours: number;
}

/** The newest claim that is not dismissed, how many others wait, and its age in hours (RIN-1714). */
export function readResumeBannerClaim(now: number = Date.now()): ResumeBannerClaim | null {
  const dismissed = new Set(readDismissals(now).map((item) => item.attemptId));
  const open = readGuestClaims(now)
    .filter((claim) => !dismissed.has(claim.attemptId))
    .sort((a, b) => b.takenAt - a.takenAt);
  const latest = open[0];
  if (!latest) return null;
  return {
    latest,
    others: open.length - 1,
    ageHours: Math.max(0, Math.floor((now - latest.takenAt) / HOUR_MS)),
  };
}

/** Hide the banner for this attempt for 7 days. Storage errors mean "not dismissed". */
export function dismissResumeBanner(attemptId: string, now: number = Date.now()): void {
  const storage = getStorage();
  if (!storage) return;
  const entries = [
    { attemptId, at: now },
    ...readDismissals(now).filter((item) => item.attemptId !== attemptId),
  ].slice(0, DISMISS_MAX_ENTRIES);
  try {
    storage.setItem(GUEST_RESUME_DISMISSED_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Quota or disabled storage.
  }
}

const RESUME_SIGN_IN_MARKER_KEY = 'rinkuzu.resumeBannerSignIn.v1';

/**
 * Set when the resume banner starts Google sign-in, so the claim that follows in the same
 * tab is reported with `source: 'resume_banner'` (RIN-1714). Session scoped, value-free.
 */
export function markResumeBannerSignIn(): void {
  try {
    window.sessionStorage.setItem(RESUME_SIGN_IN_MARKER_KEY, '1');
  } catch {
    // Storage disabled: the claim is reported without a source.
  }
}

/** True once after `markResumeBannerSignIn`; the marker is removed as it is read. */
export function consumeResumeBannerSignIn(): boolean {
  try {
    const marked = window.sessionStorage.getItem(RESUME_SIGN_IN_MARKER_KEY) === '1';
    if (marked) window.sessionStorage.removeItem(RESUME_SIGN_IN_MARKER_KEY);
    return marked;
  } catch {
    return false;
  }
}
