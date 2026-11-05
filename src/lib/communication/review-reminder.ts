import 'server-only';

import type { Types } from 'mongoose';

import { ReviewReminderRepository } from '@/repositories/ReviewReminderRepository';
import { CommunicationError, digest, requiredObjectId, siteUrl } from './internal';
import { communicationEnvironment } from './resend';
import {
  evaluateReviewReminder,
  REVIEW_REMINDER_CAMPAIGN,
  REVIEW_REMINDER_CAP_MS,
  REVIEW_REMINDER_QA_CAMPAIGN,
  reviewReminderAvailableAt,
  reviewReminderDedupeKey,
  reviewReminderQaRecipients,
  reviewRetryUrl,
  oneClickUnsubscribeUrl,
  unsubscribePageUrl,
  unsubscribeToken,
  verifyUnsubscribeToken,
  type ReviewReminderCancelReason,
} from './review-reminder-policy';
import { renderReviewReminder, type ReviewReminderLocale } from './templates';

/**
 * Kill switch for review emails. On by default now that the one-click
 * unsubscribe page and its RFC 8058 POST handler are live (RIN-915 part 2);
 * `REVIEW_REMINDER_SENDING_ENABLED=false` stops the worker claiming
 * `review_reminder` rows. Rows held back past their send window are later
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

/**
 * Result-page opt-in (AC3/AC4): records consent, then schedules one email
 * 48 h after the attempt. Idempotent per attempt; a second opt-in in the same
 * 7-day bucket re-points the pending row at the newer attempt.
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
  const availableAt = reviewReminderAvailableAt({
    takenAt: attempt.takenAt,
    email: input.email,
    now,
  });
  if (!availableAt) {
    throw new CommunicationError(
      'attempt_too_old',
      'This attempt is too old for a 2-day reminder',
      409,
    );
  }

  const wasOptedIn = await repository.optIn(userId, input.locale, now);
  if (!wasOptedIn) {
    await repository.recordConsent({
      userId,
      action: 'opt_in',
      source: 'result_page_review',
      ipHash: ipHash(input.ip),
    });
  }

  const outcome = await repository.upsertPending({
    dedupeKey: reviewReminderDedupeKey(userId.toString(), availableAt),
    attemptId: attempt.id,
    userId,
    to: input.email,
    from: communicationEnvironment('SUPPORT_MAIL_FROM'),
    body: DEFERRED_BODY,
    availableAt,
  });
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
  return { optedIn: true, status: 'capped', scheduledFor: null };
}

/**
 * Opt-out of `study_reminders` (result page untick, or the unsubscribe link):
 * records the event when the preference changes and cancels pending rows.
 */
export async function optOutReviewReminder(input: {
  userId: string;
  source: 'result_page_review' | 'unsubscribe';
  ip: string | null;
}): Promise<{ optedIn: false }> {
  const userId = requiredObjectId(input.userId, 'user id');
  if (await repository.optOut(userId)) {
    await repository.recordConsent({
      userId,
      action: 'opt_out',
      source: input.source,
      ipHash: ipHash(input.ip),
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
  | { decision: 'cancel'; reason: ReviewReminderCancelReason };

function reminderLocale(value: string | null | undefined): ReviewReminderLocale {
  return value === 'en' ? 'en' : 'vi';
}

/**
 * Send-time eligibility (AC5) and rendering for one claimed outbox row. The
 * email carries the quiz title and the number of missed questions, never the
 * answers.
 */
export async function prepareReviewReminder(
  item: { _id: Types.ObjectId; entityId: Types.ObjectId; availableAt: Date },
  now: Date = new Date(),
): Promise<ReviewReminderPreparation> {
  const attempt = await repository.findAttempt(item.entityId);
  const userId = attempt?.userId;
  if (!attempt || !userId) return { decision: 'cancel', reason: 'attempt_missing' };
  const facts = await repository.sendFacts({
    outboxId: item._id,
    attempt: { ...attempt, userId },
    capSince: new Date(now.getTime() - REVIEW_REMINDER_CAP_MS),
  });
  const verdict = evaluateReviewReminder({
    now,
    availableAt: item.availableAt,
    user: facts.user,
    optedIn: facts.preference?.studyReminders === true,
    laterAttempt: facts.laterAttempt,
    sentInLastWeek: facts.sentInLastWeek,
    qaRecipients: reviewReminderQaRecipients(),
  });
  if (verdict.decision !== 'send') return verdict;
  if (!facts.quiz) return { decision: 'cancel', reason: 'quiz_missing' };

  const locale = reminderLocale(facts.preference?.locale);
  const site = siteUrl();
  const token = unsubscribeToken(userId.toString(), communicationEnvironment('AUTH_SECRET'));
  const rendered = await renderReviewReminder({
    locale,
    quizTitle: facts.quiz.title,
    missedCount: Math.max(0, attempt.totalQuestions - attempt.correctAnswers),
    retryUrl: reviewRetryUrl({
      siteUrl: site,
      locale,
      slug: facts.quiz.slug,
      attemptId: attempt.id.toString(),
    }),
    unsubscribeUrl: unsubscribePageUrl(site, locale, token),
  });
  return {
    decision: 'send',
    mail: {
      ...rendered,
      tags: [
        {
          name: 'campaign',
          value: verdict.qa ? REVIEW_REMINDER_QA_CAMPAIGN : REVIEW_REMINDER_CAMPAIGN,
        },
      ],
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
 * `invalid`; a missing account or preference reads as `unsubscribed`, so the
 * page never reveals whether an account exists.
 */
export async function unsubscribeLinkState(token: string): Promise<UnsubscribeLinkState> {
  const userId = verifiedUserId(token);
  if (!userId) return 'invalid';
  return (await repository.studyRemindersEnabled(requiredObjectId(userId, 'user id')))
    ? 'subscribed'
    : 'unsubscribed';
}

/**
 * One-click unsubscribe (RFC 8058 POST or the page button): records the
 * opt-out with source `unsubscribe` and cancels pending review emails.
 * Idempotent; returns false for a token that is not authentic.
 */
export async function unsubscribeWithToken(token: string, ip: string | null): Promise<boolean> {
  const userId = verifiedUserId(token);
  if (!userId) return false;
  await optOutReviewReminder({ userId, source: 'unsubscribe', ip });
  return true;
}
