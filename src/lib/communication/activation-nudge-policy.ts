import { createHmac, timingSafeEqual } from 'node:crypto';

import type { NudgeBlockers, NudgeLearner } from '@/repositories/ActivationNudgeRepository';
import {
  isAnalyticsExcludedAccount,
  type LearnerExclusionFields,
} from '@/shared/constants/analytics-exclusions';
import type { StarterQuizDto } from '@/dtos/dashboard';
import { pickStarterQuizIndex } from '@/services/dashboard/starter-quizzes';
import { ACTIVATION_EMAIL_ENTRY } from '@/shared/constants/starter-quiz';

/**
 * Pure rules for the one-time activation nudge (RIN-998 / RIN-999): who is
 * swept, the per-account dedupe key, eligibility (enqueue and send time) and
 * the CTA URL and the signed click token. No database access, so every rule
 * is table-testable.
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** The email goes out once a signup is at least this old. */
const ACTIVATION_NUDGE_DELAY_MS = 24 * HOUR_MS;
/**
 * The sweep looks back this far, so a worker outage loses nobody; older
 * accounts belong to the one-time backfill.
 */
const ACTIVATION_NUDGE_LOOKBACK_MS = 7 * DAY_MS;
export const ACTIVATION_NUDGE_CAMPAIGN = 'activation_nudge';

export type ActivationNudgeLocale = 'vi' | 'en';

/**
 * Kill switch, on by default: `ACTIVATION_NUDGE_SENDING_ENABLED=false` stops
 * both the sweep and the worker claiming `activation_nudge` rows.
 */
export function activationNudgeSendingEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env['ACTIVATION_NUDGE_SENDING_ENABLED']?.trim().toLowerCase() !== 'false';
}

/** Signups in `(now − 7 d, now − 24 h]` are swept. */
export function activationNudgeSignupWindow(now: Date): { after: Date; until: Date } {
  return {
    after: new Date(now.getTime() - ACTIVATION_NUDGE_LOOKBACK_MS),
    until: new Date(now.getTime() - ACTIVATION_NUDGE_DELAY_MS),
  };
}

/** One row per account for its lifetime. */
export function activationNudgeDedupeKey(userId: string): string {
  return `activation_nudge:${userId}`;
}

export function activationNudgeLocale(value: string | null | undefined): ActivationNudgeLocale {
  return value === 'en' ? 'en' : 'vi';
}

export type ActivationNudgeSkipReason =
  | 'user_missing'
  | 'too_early'
  | 'too_late'
  | 'excluded_account'
  | 'activated'
  | 'unsubscribed'
  | 'already_nudged';

/** @public Table-tested directly; production callers go through `decideActivationNudge`. */
export interface ActivationNudgeFacts {
  now: Date;
  user: (LearnerExclusionFields & { createdAt: Date }) | null;
  /** Any completed quiz attempt or adaptive completion (the activation route's definition). */
  activated: boolean;
  /**
   * Unsubscribed from any Rinkuzu email: an opt-out consent event, a
   * non-deliverable contact state (bounce, complaint, suppression) or a
   * feedback-outreach opt-out.
   */
  unsubscribed: boolean;
  /** Another `activation_nudge` row exists for this account (any status). */
  alreadyNudged: boolean;
  /**
   * The row's trigger. A `24h` nudge is not sent once the signup is older
   * than the sweep's look-back (7 d), e.g. after a long adaptive outage kept
   * the row retrying; the backfill has no such cap.
   */
  trigger?: string | null | undefined;
}

export type ActivationNudgeDecision =
  | { decision: 'send' }
  | { decision: 'skip'; reason: ActivationNudgeSkipReason };

/**
 * Eligibility, applied when the sweep or the backfill enqueues and again when
 * the worker sends.
 * @public Table-tested directly; production callers go through `decideActivationNudge`.
 */
export function evaluateActivationNudge(facts: ActivationNudgeFacts): ActivationNudgeDecision {
  const { user } = facts;
  if (!user) return { decision: 'skip', reason: 'user_missing' };
  if (facts.now.getTime() - user.createdAt.getTime() < ACTIVATION_NUDGE_DELAY_MS) {
    return { decision: 'skip', reason: 'too_early' };
  }
  if (
    facts.trigger !== 'backfill' &&
    facts.now.getTime() - user.createdAt.getTime() > ACTIVATION_NUDGE_LOOKBACK_MS
  ) {
    return { decision: 'skip', reason: 'too_late' };
  }
  if (isAnalyticsExcludedAccount(user)) return { decision: 'skip', reason: 'excluded_account' };
  if (facts.activated) return { decision: 'skip', reason: 'activated' };
  if (facts.unsubscribed) return { decision: 'skip', reason: 'unsubscribed' };
  if (facts.alreadyNudged) return { decision: 'skip', reason: 'already_nudged' };
  return { decision: 'send' };
}

/**
 * `evaluateActivationNudge` for one learner of a batch: the sweep, the
 * worker's send-time check and the backfill all decide through this.
 * `adaptive` holds the ids with an adaptive completion.
 */
export function decideActivationNudge(
  learner: NudgeLearner,
  blockers: NudgeBlockers,
  adaptive: ReadonlySet<string>,
  now: Date,
  trigger?: string | null,
): ActivationNudgeDecision {
  const id = learner.id.toString();
  return evaluateActivationNudge({
    now,
    user: learner,
    activated: blockers.attempted.has(id) || adaptive.has(id),
    unsubscribed: blockers.unsubscribed.has(id),
    alreadyNudged: blockers.nudged.has(id),
    trigger,
  });
}

/**
 * The greeting name: the given name only. Vietnamese full names put it last
 * ("Nguyễn Văn An" → "An"), English ones first. `null` when there is nothing
 * usable, and the email then greets without a name.
 */
export function activationNudgeFirstName(
  name: string | null | undefined,
  locale: ActivationNudgeLocale,
): string | null {
  const parts = (name ?? '').trim().split(/\s+/u).filter(Boolean);
  const picked = locale === 'vi' ? parts.at(-1) : parts[0];
  if (!picked || !/^\p{L}[\p{L}\p{M}'’-]*$/u.test(picked)) return null;
  return picked.slice(0, 30);
}

/**
 * Where a click lands: the locale-matched eligible starter quiz (its quick
 * round when long), else the dashboard. The email links to
 * {@link activationClickUrl}, which records the click and redirects here.
 */
export function activationNudgeCtaUrl(input: {
  siteUrl: string;
  locale: ActivationNudgeLocale;
  starters: readonly Pick<StarterQuizDto, 'slug' | 'locale' | 'quick'>[];
}): string {
  const starter = input.starters[pickStarterQuizIndex(input.starters, input.locale)];
  const path = starter
    ? `/${input.locale}/quiz/${encodeURIComponent(starter.slug)}`
    : `/${input.locale}/dashboard`;
  const url = new URL(path, input.siteUrl);
  if (starter?.quick) url.searchParams.set('mode', 'quick');
  url.searchParams.set('entry', ACTIVATION_EMAIL_ENTRY);
  url.searchParams.set('utm_source', 'email');
  url.searchParams.set('utm_campaign', ACTIVATION_NUDGE_CAMPAIGN);
  return url.toString();
}

/** A click link works for this long after the email is rendered; later it just redirects. */
const ACTIVATION_CLICK_TOKEN_TTL_MS = 30 * DAY_MS;
const ACTIVATION_CLICK_TOKEN_PATTERN = /^([a-f0-9]{24})\.([a-z0-9]{1,12})\.([A-Za-z0-9_-]{43})$/u;

function activationClickSignature(userId: string, expires: string, secret: string): string {
  if (!secret.trim()) throw new Error('Activation click token secret is required');
  return createHmac('sha256', secret)
    .update(`rinkuzu:activation-click:v1:${userId}:${expires}`)
    .digest('base64url');
}

/** Signed `userId.expiry.signature` for the email's CTA (RIN-1000); expires after 30 days. */
export function activationClickToken(userId: string, secret: string, now: Date): string {
  const expires = Math.floor((now.getTime() + ACTIVATION_CLICK_TOKEN_TTL_MS) / 1000).toString(36);
  return `${userId}.${expires}.${activationClickSignature(userId, expires, secret)}`;
}

/** The learner a click token was signed for, or `null` when it is forged or expired. */
export function verifyActivationClickToken(
  token: string,
  secret: string,
  now: Date,
): { userId: string } | null {
  const match = ACTIVATION_CLICK_TOKEN_PATTERN.exec(token);
  if (!match) return null;
  const [, userId = '', expires = '', signature = ''] = match;
  const expected = Buffer.from(activationClickSignature(userId, expires, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  if (Number.parseInt(expires, 36) * 1000 < now.getTime()) return null;
  return { userId };
}

/**
 * The email's CTA href: the tracked redirect. `l` picks the starter quiz even
 * when the token is invalid, so a bad link still lands somewhere useful.
 */
export function activationClickUrl(
  siteUrl: string,
  locale: ActivationNudgeLocale,
  token: string,
): string {
  const url = new URL('/api/email/activation-click', siteUrl);
  url.searchParams.set('t', token);
  url.searchParams.set('l', locale);
  return url.toString();
}
