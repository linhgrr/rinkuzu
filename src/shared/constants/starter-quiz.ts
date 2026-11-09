/**
 * Post-sign-in starter quiz (RIN-913). `/start` sends a new learner to
 * `/quiz/<starter>?entry=post_signin_starter`; the player shows an intro with
 * Skip, and Skip sets a per-browser cookie that `/start` honours.
 */
export const POST_SIGNIN_STARTER_ENTRY = 'post_signin_starter';

/** The activation nudge email's CTA lands on the starter quiz with this entry (RIN-1000). */
export const ACTIVATION_EMAIL_ENTRY = 'activation_email';

/** The homepage play-first button opens a guest starter quiz via `/try` with this entry (RIN-1178). */
export const LANDING_ENTRY = 'landing';

/** CTAs on a public quiz's landing view start the player with this entry (RIN-1241 E17). */
export const QUIZ_LANDING_ENTRY = 'quiz_landing';

/** Links from a subject hub page to a quiz carry this entry (RIN-1241 E17, hub in part 4). */
export const HUB_ENTRY = 'hub';

/** A blog post's quiz CTA opens the quiz with this entry and `?post=<slug>` (RIN-1242). */
export const BLOG_ENTRY = 'blog';

/**
 * `?entry=` values the quiz player forwards on `quiz_started`/`quiz_completed`
 * and the attempt API stores on the attempt (RIN-1256); anything else is dropped.
 */
export const TRACKED_QUIZ_ENTRIES: readonly string[] = [
  POST_SIGNIN_STARTER_ENTRY,
  ACTIVATION_EMAIL_ENTRY,
  LANDING_ENTRY,
  QUIZ_LANDING_ENTRY,
  HUB_ENTRY,
  BLOG_ENTRY,
];

/** A public blog post slug as `?post=` carries it; anything else is dropped (RIN-1242). */
export const BLOG_POST_SLUG_PATTERN = /^[a-z0-9-]{1,80}$/;

/**
 * The one post-slug check, shared with the blog CTA (RIN-1242 B2) and `/try`.
 * @public
 */
export function isBlogPostSlug(value: unknown): value is string {
  return typeof value === 'string' && BLOG_POST_SLUG_PATTERN.test(value);
}

/** Where a quiz attempt started; both fields are absent for an untracked entry. */
export interface QuizEntryAttribution {
  entry?: string;
  /** Only with `entry: 'blog'`. */
  post?: string;
}

/**
 * Keeps a tracked `entry`, and a well-formed `post` only next to `entry=blog`.
 * Untrusted input is dropped field by field, never rejected.
 */
export function resolveQuizEntryAttribution(entry: unknown, post: unknown): QuizEntryAttribution {
  if (typeof entry !== 'string' || !TRACKED_QUIZ_ENTRIES.includes(entry)) return {};
  return entry === BLOG_ENTRY && isBlogPostSlug(post) ? { entry, post } : { entry };
}

export const STARTER_SKIPPED_COOKIE = 'rk_starter_skipped';

/** Set while this browser holds an unclaimed guest result: `/start` then skips the starter (RIN-921). */
export const GUEST_CLAIM_PENDING_COOKIE = 'rk_guest_claim_pending';
