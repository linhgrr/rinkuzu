import 'server-only';

import type { Types } from 'mongoose';

import {
  ReviewReminderRepository,
  type ReminderCompletionAnchor,
} from '@/repositories/ReviewReminderRepository';
import { CommunicationError, digest, requiredObjectId, siteUrl } from './internal';
import { communicationEnvironment } from './resend';
import {
  evaluateReviewReminder,
  REVIEW_REMINDER_CAP_MS,
  REVIEW_REMINDER_KIND,
  REVIEW_REMINDER_RETRY_MS,
  reviewReminderAvailableAt,
  reviewReminderCampaign,
  reviewReminderTouch,
  reviewReminderDedupeKey,
  reviewReminderQaRecipients,
  oneClickUnsubscribeUrl,
  unsubscribePageUrl,
  unsubscribeToken,
  type UnsubscribeCampaign,
  verifyUnsubscribeToken,
  type ReviewReminderCancelReason,
  type ReviewReminderTouch,
} from './review-reminder-policy';
import {
  adaptiveFactsAfter,
  adaptiveCompletionEligibility,
  reminderContent,
  reminderSubject,
  type ReviewReminderItem,
} from './review-reminder-subject';
import { renderReviewReminder, type ReviewReminderLocale } from './templates';

/**
 * Kill switch for review emails, both touches (d2 and d5). On by default now that the one-click
 * unsubscribe page and its RFC 8058 POST handler are live (RIN-915 part 2);
 * `REVIEW_REMINDER_SENDING_ENABLED=false` stops the worker claiming
 * `review_reminder` and `review_reminder_d5` rows. Rows held back past their send window are later
 * canceled (`too_late`), never sent days late.
 */
export function reviewReminderSendingEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env['REVIEW_REMINDER_SENDING_ENABLED']?.trim().toLowerCase() !== 'false';
}

/** Body stored at enqueue time; the real email is rendered at send time. */
const DEFERRED_BODY = 'Rendered at send time (review_reminder).';

const repository = new ReviewReminderRepository();

export type ReviewReminderOptInResult =
  | { optedIn: true; status: 'scheduled'; scheduledFor: string }
  | { optedIn: true; status: 'capped'; scheduledFor: null };

function ipHash(ip: string | null): string | null {
  return ip ? digest(`${communicationEnvironment('AUTH_SECRET')}:${ip}`) : null;
}

/** Where the opt-in came from and what the rows anchor on. */
export interface ReviewPairSource {
  consentSource: 'result_page_review' | 'adaptive_end_review';
  /** The attempt's `takenAt` or the adaptive completion's `completed_at`. */
  anchoredAt: Date;
  entityType: 'attempt' | 'adaptive_completion';
  entityId: Types.ObjectId;
  anchor: ReminderCompletionAnchor | null;
  /** Error code when the anchor is past the 46 h opt-in deadline. */
  tooOldCode: 'attempt_too_old' | 'completion_too_old';
}

/**
 * Records consent, then schedules the d2 email 48 h after the anchor and the
 * final d5 touch at 120 h (RIN-1304). Both paths share the dedupe buckets, so a
 * second opt-in in the same 7-day bucket, on either path, re-points both
 * pending rows at the newer anchor (RIN-1364). Nothing is written when the
 * anchor is too old.
 */
export async function scheduleReviewReminderPair(
  input: {
    userId: Types.ObjectId;
    email: string;
    locale: ReviewReminderLocale;
    ip: string | null;
    now: Date;
  },
  source: ReviewPairSource,
): Promise<ReviewReminderOptInResult> {
  const { userId, now } = input;
  const availableAt = reviewReminderAvailableAt({
    takenAt: source.anchoredAt,
    email: input.email,
    now,
  });
  if (!availableAt) {
    throw new CommunicationError(
      source.tooOldCode,
      'This is too long ago for a 2-day reminder',
      409,
    );
  }

  const wasOptedIn = await repository.optIn(userId, input.locale, now);
  if (!wasOptedIn) {
    await repository.recordConsent({
      userId,
      action: 'opt_in',
      source: source.consentSource,
      ipHash: ipHash(input.ip),
    });
  }

  const row = {
    entityType: source.entityType,
    entityId: source.entityId,
    anchor: source.anchor,
    userId,
    to: input.email,
    from: communicationEnvironment('SUPPORT_MAIL_FROM'),
    body: DEFERRED_BODY,
  };
  const scheduleTouch = (touch: ReviewReminderTouch, at: Date) =>
    repository.upsertPending({
      ...row,
      kind: REVIEW_REMINDER_KIND[touch],
      dedupeKey: reviewReminderDedupeKey(userId.toString(), availableAt, touch),
      availableAt: at,
    });
  const outcome = await scheduleTouch('d2', availableAt);
  // d5 is scheduled whether or not d2 could be: a capped d2 still gets the final touch.
  const d5At =
    reviewReminderAvailableAt({
      takenAt: source.anchoredAt,
      email: input.email,
      now,
      touch: 'd5',
    }) ?? availableAt;
  const d5Outcome = await scheduleTouch('d5', d5At);
  if (outcome === 'scheduled') {
    return { optedIn: true, status: 'scheduled', scheduledFor: availableAt.toISOString() };
  }
  // The bucket already holds a row being sent: that one is the learner's email.
  if (outcome.conflict.status === 'processing') {
    return {
      optedIn: true,
      status: 'scheduled',
      scheduledFor: outcome.conflict.availableAt.toISOString(),
    };
  }
  if (d5Outcome === 'scheduled') {
    return { optedIn: true, status: 'scheduled', scheduledFor: d5At.toISOString() };
  }
  return { optedIn: true, status: 'capped', scheduledFor: null };
}

/**
 * Result-page opt-in (AC3/AC4): records consent, then schedules the d2 email
 * 48 h after the attempt and the final d5 touch at 120 h (RIN-1304).
 * Idempotent per attempt; a second opt-in in the same 7-day bucket re-points
 * both pending rows at the newer attempt.
 */
export async function optInReviewReminder(input: {
  userId: string;
  email: string;
  attemptId: string;
  locale: ReviewReminderLocale;
  ip: string | null;
  now?: Date;
}): Promise<ReviewReminderOptInResult> {
  const now = input.now ?? new Date();
  const userId = requiredObjectId(input.userId, 'user id');
  const attempt = await repository.findAttempt(requiredObjectId(input.attemptId, 'attempt id'));
  // Someone else's attempt answers like a missing one: no existence oracle.
  if (!attempt?.userId?.equals(userId)) {
    throw new CommunicationError('not_found', 'Attempt not found', 404);
  }
  return scheduleReviewReminderPair(
    { userId, email: input.email, locale: input.locale, ip: input.ip, now },
    {
      consentSource: 'result_page_review',
      anchoredAt: attempt.takenAt,
      entityType: 'attempt',
      entityId: attempt.id,
      anchor: null,
      tooOldCode: 'attempt_too_old',
    },
  );
}

/**
 * Adaptive end-screen opt-in (Path B, RIN-1364). The anchor is the learner's
 * latest adaptive completion, resolved here from the API: the client sends no
 * timestamps. A completion older than 46 h (or followed by a quiz attempt) is
 * refused before any consent is recorded.
 */
export async function optInAdaptiveReviewReminder(input: {
  userId: string;
  email: string;
  locale: ReviewReminderLocale;
  ip: string | null;
  now?: Date;
}): Promise<ReviewReminderOptInResult> {
  const now = input.now ?? new Date();
  const userId = requiredObjectId(input.userId, 'user id');
  const eligibility = await adaptiveCompletionEligibility(userId, input.email, now);
  if (eligibility.status === 'unavailable') {
    throw new CommunicationError('adaptive_unavailable', 'Please try again in a moment', 503);
  }
  if (eligibility.status === 'ineligible') {
    throw new CommunicationError(
      'completion_too_old',
      'No recent personalized session for a 2-day reminder',
      409,
    );
  }
  const { completion } = eligibility;
  return scheduleReviewReminderPair(
    { userId, email: input.email, locale: input.locale, ip: input.ip, now },
    {
      consentSource: 'adaptive_end_review',
      anchoredAt: completion.completedAt,
      entityType: 'adaptive_completion',
      entityId: userId,
      anchor: { at: completion.completedAt, documentId: completion.documentId },
      tooOldCode: 'completion_too_old',
    },
  );
}

/** "No thanks" on the result-page prompt hides it for 7 days on every device (RIN-1362). */
const REVIEW_PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export interface ReviewReminderPromptStatus {
  /** `study_reminders` is ticked. */
  optedIn: boolean;
  /** Set only while the prompt is snoozed (in the future). */
  snoozedUntil: string | null;
  /**
   * The attempt is the learner's own and latest, has missed questions and is
   * still in the opt-in window.
   */
  eligible: boolean;
}

async function attemptEligible(
  userId: Types.ObjectId,
  attemptId: string | null | undefined,
  email: string,
  now: Date,
): Promise<boolean> {
  if (!attemptId) return false;
  const attempt = await repository.findAttempt(requiredObjectId(attemptId, 'attempt id'));
  if (!attempt?.userId?.equals(userId)) return false;
  if (attempt.totalQuestions - attempt.correctAnswers <= 0) return false;
  if (reviewReminderAvailableAt({ takenAt: attempt.takenAt, email, now }) === null) return false;
  // An older attempt's email would be canceled at send time (`later_attempt`),
  // and re-pointing the pending row at it would drop the newer one's email.
  return !(await repository.hasLaterAttempt(userId, attempt.takenAt));
}

/**
 * What the result-page review prompt shows (RIN-1362): opted in, snoozed by
 * "No thanks", and whether this attempt can still get a 2-day email.
 */
export async function reviewReminderStatus(input: {
  userId: string;
  email: string;
  attemptId?: string | null | undefined;
  /** `adaptive`: the adaptive end screen, eligible on the latest completion (RIN-1364). */
  path?: 'quiz' | 'adaptive';
  now?: Date;
}): Promise<ReviewReminderPromptStatus> {
  const now = input.now ?? new Date();
  const userId = requiredObjectId(input.userId, 'user id');
  const [preference, eligible] = await Promise.all([
    repository.promptPreference(userId),
    input.path === 'adaptive'
      ? adaptiveCompletionEligibility(userId, input.email, now).then(
          (eligibility) => eligibility.status === 'eligible',
        )
      : attemptEligible(userId, input.attemptId, input.email, now),
  ]);
  const until = preference.snoozedUntil;
  return {
    optedIn: preference.optedIn,
    snoozedUntil: until && until.getTime() > now.getTime() ? until.toISOString() : null,
    eligible,
  };
}

/** "No thanks": hides the prompt until now + 7 days. Not a consent change, so no consent event. */
export async function snoozeReviewReminderPrompt(input: {
  userId: string;
  now?: Date;
}): Promise<{ snoozedUntil: string }> {
  const now = input.now ?? new Date();
  const until = new Date(now.getTime() + REVIEW_PROMPT_SNOOZE_MS);
  await repository.snoozePrompt(requiredObjectId(input.userId, 'user id'), until);
  return { snoozedUntil: until.toISOString() };
}

/**
 * Opt-out of `study_reminders` (result page untick, or the unsubscribe link):
 * records the event when the preference changes and cancels pending rows. The
 * unsubscribe link also records it for a learner who never opted in (the
 * activation nudge, RIN-999), so every later send sees the opt-out.
 */
export async function optOutReviewReminder(input: {
  userId: string;
  source: 'result_page_review' | 'adaptive_end_review' | 'unsubscribe';
  ip: string | null;
  campaign?: UnsubscribeCampaign | null;
}): Promise<{ optedIn: false }> {
  const userId = requiredObjectId(input.userId, 'user id');
  const changed = await repository.optOut(userId);
  if (changed || (input.source === 'unsubscribe' && !(await repository.hasOptedOut(userId)))) {
    await repository.recordConsent({
      userId,
      action: 'opt_out',
      source: input.source,
      ipHash: ipHash(input.ip),
      ...(input.campaign ? { campaign: input.campaign } : {}),
    });
  }
  await repository.cancelPending(userId, 'opted_out');
  return { optedIn: false };
}

interface PreparedReviewReminder {
  subject: string;
  html: string;
  text: string;
  tags: Array<{ name: string; value: string }>;
  headers: Record<string, string>;
}

export type ReviewReminderPreparation =
  | { decision: 'send'; mail: PreparedReviewReminder }
  | { decision: 'wait' }
  /** The adaptive API could not be asked: claim the row again at `availableAt`. */
  | { decision: 'retry'; availableAt: Date }
  | { decision: 'cancel'; reason: ReviewReminderCancelReason };

function reminderLocale(value: string | null | undefined): ReviewReminderLocale {
  return value === 'en' ? 'en' : 'vi';
}

/**
 * Send-time eligibility (AC5) and rendering for one claimed outbox row, on
 * either path (RIN-1364). Both paths are canceled by a later quiz attempt and
 * by a later adaptive completion; when the adaptive API cannot be asked the
 * row is retried inside its window, then canceled `too_late`. The email
 * carries a title and a count, never questions or answers.
 */
export async function prepareReviewReminder(
  item: ReviewReminderItem,
  now: Date = new Date(),
): Promise<ReviewReminderPreparation> {
  const touch = reviewReminderTouch(item.kind);
  const subject = await reminderSubject(item);
  const missingReason =
    item.entityType === 'adaptive_completion' ? 'completion_missing' : 'attempt_missing';
  if (!subject) return { decision: 'cancel', reason: missingReason };
  const { userId } = subject;
  const facts = await repository.sendFacts({
    outboxId: item._id,
    userId,
    after: subject.after,
    quizId: subject.path === 'quiz' ? subject.attempt.quizId : null,
    capSince: new Date(now.getTime() - REVIEW_REMINDER_CAP_MS),
  });
  const verdict = evaluateReviewReminder({
    now,
    // The window runs from the original due time, so retries never stretch it.
    availableAt: item.dueAt ?? item.availableAt,
    user: facts.user,
    optedIn: facts.preference?.studyReminders === true,
    laterAttempt: facts.laterAttempt,
    sentInLastWeek: facts.sentInLastWeek,
    qaRecipients: reviewReminderQaRecipients(),
  });
  if (verdict.decision !== 'send') return verdict;
  if (subject.path === 'quiz' && !facts.quiz) return { decision: 'cancel', reason: 'quiz_missing' };

  const adaptive = await adaptiveFactsAfter(userId, subject.after);
  if (!adaptive) {
    return { decision: 'retry', availableAt: new Date(now.getTime() + REVIEW_REMINDER_RETRY_MS) };
  }
  if (adaptive.completionsAfter.length > 0) {
    return { decision: 'cancel', reason: 'later_completion' };
  }

  const locale = reminderLocale(facts.locale);
  const site = siteUrl();
  const content = reminderContent(subject, facts.quiz, adaptive, { site, locale, touch });
  if (!content) return { decision: 'cancel', reason: missingReason };

  const token = unsubscribeToken(userId.toString(), communicationEnvironment('AUTH_SECRET'));
  const rendered = await renderReviewReminder({
    touch,
    path: content.path,
    locale,
    quizTitle: content.title,
    missedCount: content.count,
    retryUrl: content.url,
    unsubscribeUrl: unsubscribePageUrl(site, locale, token),
  });
  return {
    decision: 'send',
    mail: {
      ...rendered,
      tags: [{ name: 'campaign', value: reviewReminderCampaign(touch, verdict.qa) }],
      headers: {
        // No unsubscribe mailbox exists, so the header carries the HTTPS URL only.
        'List-Unsubscribe': `<${oneClickUnsubscribeUrl(site, token)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    },
  };
}

export type UnsubscribeLinkState = 'invalid' | 'subscribed' | 'unsubscribed';

function verifiedUserId(token: string): string | null {
  return verifyUnsubscribeToken(token, communicationEnvironment('AUTH_SECRET'))?.userId ?? null;
}

/**
 * What the signed-out unsubscribe page shows for a link. A tampered token is
 * `invalid`. `subscribed` while the learner is opted in or has never opted
 * out (an activation-nudge recipient); a missing account reads like any
 * unknown id, so the page never reveals whether an account exists.
 */
export async function unsubscribeLinkState(token: string): Promise<UnsubscribeLinkState> {
  const userId = verifiedUserId(token);
  if (!userId) return 'invalid';
  const id = requiredObjectId(userId, 'user id');
  if (await repository.studyRemindersEnabled(id)) return 'subscribed';
  return (await repository.hasOptedOut(id)) ? 'unsubscribed' : 'subscribed';
}

/**
 * One-click unsubscribe (RFC 8058 POST or the page button): records the
 * opt-out with source `unsubscribe` (and the email's `campaign`, RIN-1044)
 * and cancels pending review emails. Idempotent; returns false for a token
 * that is not authentic.
 */
export async function unsubscribeWithToken(
  token: string,
  ip: string | null,
  campaign: UnsubscribeCampaign | null = null,
): Promise<boolean> {
  const userId = verifiedUserId(token);
  if (!userId) return false;
  await optOutReviewReminder({ userId, source: 'unsubscribe', ip, campaign });
  return true;
}
