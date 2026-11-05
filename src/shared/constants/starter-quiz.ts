/**
 * Post-sign-in starter quiz (RIN-913). `/start` sends a new learner to
 * `/quiz/<starter>?entry=post_signin_starter`; the player shows an intro with
 * Skip, and Skip sets a per-browser cookie that `/start` honours.
 */
export const POST_SIGNIN_STARTER_ENTRY = 'post_signin_starter';

export const STARTER_SKIPPED_COOKIE = 'rk_starter_skipped';
