import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  isAnalyticsExcludedAccount,
  type LearnerExclusionFields,
} from '@/shared/constants/analytics-exclusions';
import { ACCOUNT_DISABLE_DISABLED } from '@/shared/constants/account-disable';

/**
 * Pure rules for the opt-in 2-day review email (RIN-911 / RIN-915): timing,
 * the weekly cap key, send-time eligibility and the unsubscribe token. No
 * database access, so every rule is table-testable with a fake clock.
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export const REVIEW_REMINDER_DELAY_MS = 48 * HOUR_MS;
/** A learner gets at most one review email per 7 days. */
export const REVIEW_REMINDER_CAP_MS = 7 * DAY_MS;
/** The spec allows ±2 h, so an opt-in later than 46 h after the attempt is refused. */
export const REVIEW_REMINDER_LATEST_OPT_IN_MS = REVIEW_REMINDER_DELAY_MS - 2 * HOUR_MS;
/**
 * The spec allows ±2 h around the due time. A row still unsent 2 h after it
 * became due (sending switched off, worker outage) is canceled rather than
 * sent days late with "two days ago" copy. Applies to QA recipients too.
 */
export const REVIEW_REMINDER_SEND_WINDOW_MS = 2 * HOUR_MS;
export const REVIEW_REMINDER_CAMPAIGN = 'w1-review';
/** QA sends carry their own campaign tag so they never count in admin aggregates. */
export const REVIEW_REMINDER_QA_CAMPAIGN = 'w1-review-qa';
export const REVIEW_REMINDER_TOPIC = 'study_reminders';

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

export function isReviewReminderQaRecipient(
  email: string,
  env: Environment = process.env,
): boolean {
  return reviewReminderQaRecipients(env).has(email.trim().toLowerCase());
}

/**
 * Delay between the attempt and the email: 48 h, or for a QA recipient only,
 * `REVIEW_EMAIL_QA_DELAY_MINUTES` when it is a positive number.
 */
export function reviewReminderDelayMs(email: string, env: Environment = process.env): number {
  if (!isReviewReminderQaRecipient(email, env)) return REVIEW_REMINDER_DELAY_MS;
  const minutes = Number(env['REVIEW_EMAIL_QA_DELAY_MINUTES']?.trim() ?? '');
  return Number.isFinite(minutes) && minutes > 0
    ? Math.min(minutes * 60_000, REVIEW_REMINDER_DELAY_MS)
    : REVIEW_REMINDER_DELAY_MS;
}

/**
 * When the email for an attempt becomes due, or `null` when the opt-in comes
 * too late to send it on time (only QA recipients may send right away).
 */
export function reviewReminderAvailableAt(input: {
  takenAt: Date;
  email: string;
  now: Date;
  env?: Environment;
}): Date | null {
  const env = input.env ?? process.env;
  const due = input.takenAt.getTime() + reviewReminderDelayMs(input.email, env);
  if (isReviewReminderQaRecipient(input.email, env)) {
    return new Date(Math.max(due, input.now.getTime()));
  }
  if (input.now.getTime() > input.takenAt.getTime() + REVIEW_REMINDER_LATEST_OPT_IN_MS) {
    return null;
  }
  return new Date(due);
}

/**
 * One outbox row per learner per 7-day bucket. The send-time cap below covers
 * two buckets that fall closer than 7 days apart.
 */
export function reviewReminderDedupeKey(userId: string, availableAt: Date): string {
  return `review_reminder/${userId}/${Math.floor(availableAt.getTime() / REVIEW_REMINDER_CAP_MS)}`;
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
  /** Another review email was sent to this learner in the last 7 days. */
  sentInLastWeek: boolean;
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
  if (facts.sentInLastWeek) return { decision: 'cancel', reason: 'weekly_cap' };
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

/** The `(userId, topic)` a token was signed for, or `null` when it is not authentic. */
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
}): string {
  const url = new URL(
    `/${encodeURIComponent(input.locale)}/quiz/${encodeURIComponent(input.slug)}`,
    input.siteUrl,
  );
  url.searchParams.set('retryOf', input.attemptId);
  url.searchParams.set('utm_source', 'email');
  url.searchParams.set('utm_campaign', REVIEW_REMINDER_CAMPAIGN);
  return url.toString();
}

export function unsubscribeUrl(siteUrl: string, token: string): string {
  const url = new URL('/unsubscribe', siteUrl);
  url.searchParams.set('t', token);
  return url.toString();
}
