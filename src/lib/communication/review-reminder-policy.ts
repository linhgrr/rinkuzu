import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  isAnalyticsExcludedAccount,
  type LearnerExclusionFields,
} from '@/shared/constants/analytics-exclusions';
import { ACCOUNT_DISABLE_DISABLED } from '@/shared/constants/account-disable';

/**
 * Pure rules for the opt-in review emails (RIN-911 / RIN-915): the day-2
 * email and the final day-5 touch (RIN-1304). Timing, the 7-day bucket keys,
 * send-time eligibility and the unsubscribe token. No database access, so
 * every rule is table-testable with a fake clock.
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** `d2` is the 48 h email (RIN-911); `d5` the final touch 120 h after the attempt (RIN-1304). */
export type ReviewReminderTouch = 'd2' | 'd5';
export const REVIEW_REMINDER_KINDS = ['review_reminder', 'review_reminder_d5'] as const;
export type ReviewReminderKind = (typeof REVIEW_REMINDER_KINDS)[number];

const REVIEW_REMINDER_DELAY_MS = 48 * HOUR_MS;
const TOUCH_DELAY_MS: Record<ReviewReminderTouch, number> = {
  d2: REVIEW_REMINDER_DELAY_MS,
  d5: 120 * HOUR_MS,
};
/** Outbox kind of each touch; d2 keeps the RIN-915 kind so existing rows stay valid. */
export const REVIEW_REMINDER_KIND: Record<ReviewReminderTouch, ReviewReminderKind> = {
  d2: 'review_reminder',
  d5: 'review_reminder_d5',
};

export function reviewReminderTouch(kind: string): ReviewReminderTouch {
  return kind === REVIEW_REMINDER_KIND.d5 ? 'd5' : 'd2';
}

/** The rolling window of the cap: at most `REVIEW_REMINDER_WEEKLY_LIMIT` review emails in it. */
export const REVIEW_REMINDER_CAP_MS = 7 * DAY_MS;
/** d2 + d5: a third review email inside 7 days is canceled `weekly_cap` (RIN-1304). */
const REVIEW_REMINDER_WEEKLY_LIMIT = 2;
/** The spec allows ±2 h, so an opt-in later than 46 h after the attempt is refused. */
const REVIEW_REMINDER_LATEST_OPT_IN_MS = REVIEW_REMINDER_DELAY_MS - 2 * HOUR_MS;
/**
 * The spec allows ±2 h around the due time. A row still unsent 2 h after it
 * became due (sending switched off, worker outage) is canceled rather than
 * sent days late with "two days ago" copy. Applies to QA recipients too.
 */
const REVIEW_REMINDER_SEND_WINDOW_MS = 2 * HOUR_MS;
export const REVIEW_REMINDER_CAMPAIGN = 'w1-review';
export const REVIEW_REMINDER_D5_CAMPAIGN = 'w1-review-d5';
/**
 * Campaign tag (and `utm_campaign`) of each touch. QA sends carry their own
 * tag (`w1-review-qa`, `w1-review-d5-qa`) so they never count in admin aggregates.
 */
export function reviewReminderCampaign(touch: ReviewReminderTouch, qa = false): string {
  const campaign = touch === 'd5' ? REVIEW_REMINDER_D5_CAMPAIGN : REVIEW_REMINDER_CAMPAIGN;
  return qa ? `${campaign}-qa` : campaign;
}
const REVIEW_REMINDER_TOPIC = 'study_reminders';

/**
 * Email a `study_reminders` unsubscribe link came from (RIN-1044), carried as
 * the unsigned `?c=` parameter. It only attributes the opt-out, which applies
 * to every later send either way; links without it are the review email's.
 */
const UNSUBSCRIBE_CAMPAIGNS = ['activation_nudge'] as const;
export type UnsubscribeCampaign = (typeof UNSUBSCRIBE_CAMPAIGNS)[number];
const UNSUBSCRIBE_CAMPAIGN_PARAM = 'c';

/** The known campaign named by a `?c=` value, or `null` for anything else. */
export function unsubscribeCampaign(value: unknown): UnsubscribeCampaign | null {
  return UNSUBSCRIBE_CAMPAIGNS.find((campaign) => campaign === value) ?? null;
}

type Environment = Readonly<Record<string, string | undefined>>;

/** Lowercased `REVIEW_EMAIL_QA_RECIPIENTS` (comma separated); empty when unset. */
export function reviewReminderQaRecipients(env: Environment = process.env): ReadonlySet<string> {
  return new Set(
    (env['REVIEW_EMAIL_QA_RECIPIENTS'] ?? '')
      .split(',')
      .map((address) => address.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isReviewReminderQaRecipient(email: string, env: Environment = process.env): boolean {
  return reviewReminderQaRecipients(env).has(email.trim().toLowerCase());
}

/**
 * Delay between the attempt and the email: 48 h (d2) or 120 h (d5). For a QA
 * recipient only, `REVIEW_EMAIL_QA_DELAY_MINUTES` (when a positive number)
 * replaces the d2 delay and scales d5 by the same factor (x 2.5).
 */
function reviewReminderDelayMs(
  email: string,
  env: Environment,
  touch: ReviewReminderTouch,
): number {
  const delay = TOUCH_DELAY_MS[touch];
  if (!isReviewReminderQaRecipient(email, env)) return delay;
  const minutes = Number(env['REVIEW_EMAIL_QA_DELAY_MINUTES']?.trim() ?? '');
  return Number.isFinite(minutes) && minutes > 0
    ? Math.min((minutes * 60_000 * delay) / REVIEW_REMINDER_DELAY_MS, delay)
    : delay;
}

/**
 * When a touch for an attempt becomes due, or `null` when the opt-in comes
 * too late to send the d2 email on time (only QA recipients may send right
 * away). The opt-in deadline is d2's for both touches.
 */
export function reviewReminderAvailableAt(input: {
  takenAt: Date;
  email: string;
  now: Date;
  env?: Environment;
  touch?: ReviewReminderTouch;
}): Date | null {
  const env = input.env ?? process.env;
  const due =
    input.takenAt.getTime() + reviewReminderDelayMs(input.email, env, input.touch ?? 'd2');
  if (isReviewReminderQaRecipient(input.email, env)) {
    return new Date(Math.max(due, input.now.getTime()));
  }
  if (input.now.getTime() > input.takenAt.getTime() + REVIEW_REMINDER_LATEST_OPT_IN_MS) {
    return null;
  }
  return new Date(due);
}

/**
 * One outbox row per learner, touch and 7-day bucket. Both touches take the
 * bucket of the d2 due time, so a newer opt-in in the same bucket re-points
 * the d5 row with the d2 row. The send-time cap below covers two buckets that
 * fall closer than 7 days apart.
 */
export function reviewReminderDedupeKey(
  userId: string,
  d2AvailableAt: Date,
  touch: ReviewReminderTouch = 'd2',
): string {
  const bucket = Math.floor(d2AvailableAt.getTime() / REVIEW_REMINDER_CAP_MS);
  return `${REVIEW_REMINDER_KIND[touch]}/${userId}/${bucket}`;
}

export type ReviewReminderCancelReason =
  | 'attempt_missing'
  | 'quiz_missing'
  | 'user_missing'
  | 'account_disabled'
  | 'opted_out'
  | 'later_attempt'
  | 'weekly_cap'
  | 'excluded_account'
  | 'too_late';

export interface ReviewReminderFacts {
  now: Date;
  availableAt: Date;
  user: (LearnerExclusionFields & { email: string }) | null;
  /** Current `MarketingPreference.studyReminders`. */
  optedIn: boolean;
  /** Another attempt by this learner after the opted-in one. */
  laterAttempt: boolean;
  /** Other review emails (either touch) sent to this learner in the last 7 days. */
  sentInLastWeek: number;
  qaRecipients: ReadonlySet<string>;
}

export type ReviewReminderDecision =
  | { decision: 'send'; qa: boolean }
  | { decision: 'wait' }
  | { decision: 'cancel'; reason: ReviewReminderCancelReason };

/**
 * AC5, checked again at send time. The QA allowlist lifts only the learner
 * exclusion (admin, test account, test or company address); a disabled
 * account, an opt-out, a later attempt and the weekly cap always cancel.
 */
export function evaluateReviewReminder(facts: ReviewReminderFacts): ReviewReminderDecision {
  if (facts.now.getTime() < facts.availableAt.getTime()) return { decision: 'wait' };
  if (facts.now.getTime() > facts.availableAt.getTime() + REVIEW_REMINDER_SEND_WINDOW_MS) {
    return { decision: 'cancel', reason: 'too_late' };
  }
  const { user } = facts;
  if (!user) return { decision: 'cancel', reason: 'user_missing' };
  if (user.disable === ACCOUNT_DISABLE_DISABLED) {
    return { decision: 'cancel', reason: 'account_disabled' };
  }
  if (!facts.optedIn) return { decision: 'cancel', reason: 'opted_out' };
  if (facts.laterAttempt) return { decision: 'cancel', reason: 'later_attempt' };
  if (facts.sentInLastWeek >= REVIEW_REMINDER_WEEKLY_LIMIT)
    return { decision: 'cancel', reason: 'weekly_cap' };
  const qa = facts.qaRecipients.has(user.email.trim().toLowerCase());
  if (!qa && isAnalyticsExcludedAccount(user)) {
    return { decision: 'cancel', reason: 'excluded_account' };
  }
  return { decision: 'send', qa };
}

function unsubscribeSignature(userId: string, topic: string, secret: string): string {
  if (!secret.trim()) throw new Error('Unsubscribe token secret is required');
  return createHmac('sha256', secret)
    .update(`rinkuzu:unsubscribe:v1:${topic}:${userId}`)
    .digest('base64url');
}

/** Non-expiring signed token for one-click unsubscribe from `topic`. */
export function unsubscribeToken(userId: string, secret: string, topic = REVIEW_REMINDER_TOPIC) {
  return `${userId}.${topic}.${unsubscribeSignature(userId, topic, secret)}`;
}

const UNSUBSCRIBE_TOKEN_PATTERN = /^([a-f0-9]{24})\.([a-z_]{1,32})\.([A-Za-z0-9_-]{43})$/u;

/**
 * The `(userId, topic)` a token was signed for, or `null` when it is not authentic.
 * Tokens are keyed on `AUTH_SECRET`: rotating it invalidates every link already sent.
 */
export function verifyUnsubscribeToken(
  token: string,
  secret: string,
): { userId: string; topic: string } | null {
  const match = UNSUBSCRIBE_TOKEN_PATTERN.exec(token);
  if (!match) return null;
  const [, userId = '', topic = '', signature = ''] = match;
  if (topic !== REVIEW_REMINDER_TOPIC) return null;
  const expected = Buffer.from(unsubscribeSignature(userId, topic, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return { userId, topic };
}

/** Link target of the email button (the retry session ships in RIN-911's web issue). */
export function reviewRetryUrl(input: {
  siteUrl: string;
  locale: string;
  slug: string;
  attemptId: string;
  touch?: ReviewReminderTouch;
}): string {
  const url = new URL(
    `/${encodeURIComponent(input.locale)}/quiz/${encodeURIComponent(input.slug)}`,
    input.siteUrl,
  );
  url.searchParams.set('retryOf', input.attemptId);
  url.searchParams.set('utm_source', 'email');
  url.searchParams.set('utm_campaign', reviewReminderCampaign(input.touch ?? 'd2'));
  return url.toString();
}

/** Footer link: the signed-out confirm page in the learner's locale. */
export function unsubscribePageUrl(
  siteUrl: string,
  locale: string,
  token: string,
  campaign: UnsubscribeCampaign | null = null,
): string {
  const url = new URL(`/${encodeURIComponent(locale)}/unsubscribe`, siteUrl);
  url.searchParams.set('t', token);
  if (campaign) url.searchParams.set(UNSUBSCRIBE_CAMPAIGN_PARAM, campaign);
  return url.toString();
}

/**
 * `List-Unsubscribe` target: mail clients POST `List-Unsubscribe=One-Click`
 * here (RFC 8058); a plain GET redirects to the confirm page.
 */
export function oneClickUnsubscribeUrl(
  siteUrl: string,
  token: string,
  campaign: UnsubscribeCampaign | null = null,
): string {
  const url = new URL('/api/unsubscribe', siteUrl);
  url.searchParams.set('t', token);
  if (campaign) url.searchParams.set(UNSUBSCRIBE_CAMPAIGN_PARAM, campaign);
  return url.toString();
}
