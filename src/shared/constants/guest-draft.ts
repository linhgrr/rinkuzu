/** Guest quiz drafts (RIN-1441): a signed-out visitor turns their own PDF into a quiz. */

/**
 * Where the guest started; carried on every guest_draft_* event. `seo`: no known `?entry=`
 * and a search engine referrer (RIN-1497).
 */
export const GUEST_DRAFT_ENTRIES = ['landing', 'create', 'blog', 'quiz_landing', 'seo'] as const;
export type GuestDraftEntry = (typeof GUEST_DRAFT_ENTRIES)[number];

export const GUEST_DRAFT_STATUSES = ['processing', 'ready', 'failed'] as const;
export type GuestDraftStatus = (typeof GUEST_DRAFT_STATUSES)[number];

/**
 * Guest upload ceiling. The spec's 10 MB cannot hold: Vercel refuses a request body over
 * 4.5 MB before the route runs (CTO decision on RIN-1446). The API also caps pages.
 */
export const GUEST_DRAFT_MAX_PDF_BYTES = 4 * 1024 * 1024;

/** An unclaimed guest draft is deleted after this long (spec AC6). */
export const GUEST_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

/** Header that carries the guest draft token on the multipart create call. Never a URL. */
export const GUEST_DRAFT_TOKEN_HEADER = 'x-guest-draft-token';

/** `reason` on the 429 when a guest cap is hit, so the UI shows "Sign up to create more". */
export const GUEST_DRAFT_LIMIT_REASON = 'guest_draft_limit';

/**
 * Snapshot slug of an attempt on a guest draft, and the key of the review-queue progress a
 * claimed one writes (RIN-1446). Reserved: no Quiz slug starts with `guest-draft-`.
 */
export function guestDraftSnapshotSlug(draftId: string): string {
  return `guest-draft-${draftId}`;
}

/** Guest page ceiling, checked in the browser for instant feedback; the API enforces it too. */
export const GUEST_DRAFT_MAX_PAGES = 10;

/**
 * Route slug of a guest draft in the player and on its result page
 * (`/quiz/guest-draft-play/result`). Under the reserved `guest-draft-` prefix, so never a
 * real quiz, and not an id, so never a snapshot slug.
 */
export const GUEST_DRAFT_PLAY_SLUG = 'guest-draft-play';

/** A guest draft's route or snapshot slug: it has no quiz page of its own. */
export function isGuestDraftSlug(slug: string): boolean {
  return slug.startsWith('guest-draft-');
}
