/**
 * Post-sign-in starter quiz (RIN-913). `/start` sends a new learner to
 * `/quiz/<starter>?entry=post_signin_starter`; the player shows an intro with
 * Skip, and Skip sets a per-browser cookie that `/start` honours.
 */
export const POST_SIGNIN_STARTER_ENTRY = 'post_signin_starter';

/** The activation nudge email's CTA lands on the starter quiz with this entry (RIN-1000). */
export const ACTIVATION_EMAIL_ENTRY = 'activation_email';

/** `?entry=` values the quiz player forwards on `quiz_completed`; anything else is dropped. */
export const TRACKED_QUIZ_ENTRIES: readonly string[] = [
  POST_SIGNIN_STARTER_ENTRY,
  ACTIVATION_EMAIL_ENTRY,
];

export const STARTER_SKIPPED_COOKIE = 'rk_starter_skipped';

/** Set while this browser holds an unclaimed guest result: `/start` then skips the starter (RIN-921). */
export const GUEST_CLAIM_PENDING_COOKIE = 'rk_guest_claim_pending';
