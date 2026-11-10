/** Guest quiz drafts (RIN-1441): a signed-out visitor turns their own PDF into a quiz. */

/** Where the guest started; carried on every guest_draft_* event. */
export const GUEST_DRAFT_ENTRIES = ['landing', 'create', 'blog', 'quiz_landing'] as const;
export type GuestDraftEntry = (typeof GUEST_DRAFT_ENTRIES)[number];

export const GUEST_DRAFT_STATUSES = ['processing', 'ready', 'failed'] as const;
export type GuestDraftStatus = (typeof GUEST_DRAFT_STATUSES)[number];

/** Guest upload ceiling (spec AC2); the API also caps pages and questions. */
export const GUEST_DRAFT_MAX_PDF_BYTES = 10 * 1024 * 1024;

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
