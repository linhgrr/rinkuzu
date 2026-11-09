import 'server-only';

import type { Types } from 'mongoose';

import {
  AdaptiveReviewFactsUnavailableError,
  fetchAdaptiveReviewFacts,
  type AdaptiveCompletion,
  type AdaptiveReviewFacts,
} from '@/lib/adaptive/review-facts';
import { ReviewReminderRepository } from '@/repositories/ReviewReminderRepository';
import { adaptiveDocumentTitle } from './review-reminder-adaptive-copy';
import {
  adaptiveReviewUrl,
  reviewReminderAvailableAt,
  reviewRetryUrl,
  type ReviewReminderTouch,
} from './review-reminder-policy';
import type { ReviewReminderLocale } from './templates';

/**
 * What a claimed review email follows (RIN-1364): a quiz attempt (Path A) or
 * an adaptive completion (Path B), and the title, count and link it shows.
 */

const repository = new ReviewReminderRepository();

/** A claimed `review_reminder` / `review_reminder_d5` outbox row. */
export interface ReviewReminderItem {
  _id: Types.ObjectId;
  kind: string;
  /** Missing on rows written before RIN-1364, which are all Path A. */
  entityType?: string;
  entityId: Types.ObjectId;
  availableAt: Date;
  dueAt?: Date | null;
  anchorAt?: Date | null;
  anchorDocumentId?: string | null;
}

/** What the email follows: a quiz attempt (Path A) or an adaptive completion (Path B). */
export type ReminderSubject =
  | {
      path: 'quiz';
      userId: Types.ObjectId;
      after: Date;
      attempt: { id: Types.ObjectId; quizId: Types.ObjectId; missed: number };
    }
  | { path: 'adaptive'; userId: Types.ObjectId; after: Date; documentId: string | null };

export async function reminderSubject(item: ReviewReminderItem): Promise<ReminderSubject | null> {
  if (item.entityType === 'adaptive_completion') {
    if (!item.anchorAt) return null;
    return {
      path: 'adaptive',
      userId: item.entityId,
      after: item.anchorAt,
      documentId: item.anchorDocumentId ?? null,
    };
  }
  const attempt = await repository.findAttempt(item.entityId);
  if (!attempt?.userId) return null;
  return {
    path: 'quiz',
    userId: attempt.userId,
    after: attempt.takenAt,
    attempt: {
      id: attempt.id,
      quizId: attempt.quizId,
      missed: Math.max(0, attempt.totalQuestions - attempt.correctAnswers),
    },
  };
}

/** Null when the adaptive API cannot be asked: the caller retries, never sends blind. */
export async function adaptiveFactsAfter(
  userId: Types.ObjectId,
  after?: Date,
): Promise<AdaptiveReviewFacts | null> {
  try {
    return await fetchAdaptiveReviewFacts(userId.toString(), after);
  } catch (error) {
    if (error instanceof AdaptiveReviewFactsUnavailableError) return null;
    throw error;
  }
}

interface ReminderContent {
  path: 'quiz' | 'adaptive';
  title: string;
  count: number;
  url: string;
}

/** Title, count and link of the email; null when a Path B completion is gone. */
export function reminderContent(
  subject: ReminderSubject,
  quiz: { slug: string; title: string } | null,
  adaptive: AdaptiveReviewFacts,
  context: { site: string; locale: ReviewReminderLocale; touch: ReviewReminderTouch },
): ReminderContent | null {
  const { site, locale, touch } = context;
  if (subject.path === 'quiz') {
    if (!quiz) return null;
    return {
      path: 'quiz',
      title: quiz.title,
      count: subject.attempt.missed,
      url: reviewRetryUrl({
        siteUrl: site,
        locale,
        slug: quiz.slug,
        attemptId: subject.attempt.id.toString(),
        touch,
      }),
    };
  }
  const completion = adaptive.latestCompletion;
  if (!completion) return null;
  return {
    path: 'adaptive',
    title: adaptiveDocumentTitle(locale, completion.documentTitle),
    count: completion.dueCount,
    url: adaptiveReviewUrl({
      siteUrl: site,
      locale,
      documentId: completion.documentId ?? subject.documentId,
      touch,
    }),
  };
}

/**
 * Path B opt-in eligibility: the learner's latest adaptive completion while it
 * can still get a 2-day email (opt-in at most 46 h after it) and no quiz
 * attempt came after it (that attempt would cancel the email, and re-pointing
 * the bucket at this older anchor would drop the attempt's own email).
 */
export type AdaptiveCompletionEligibility =
  | { status: 'eligible'; completion: AdaptiveCompletion }
  | { status: 'ineligible' }
  | { status: 'unavailable' };

export async function adaptiveCompletionEligibility(
  userId: Types.ObjectId,
  email: string,
  now: Date,
): Promise<AdaptiveCompletionEligibility> {
  const facts = await adaptiveFactsAfter(userId);
  if (!facts) return { status: 'unavailable' };
  const completion = facts.latestCompletion;
  if (
    !completion ||
    reviewReminderAvailableAt({ takenAt: completion.completedAt, email, now }) === null ||
    (await repository.hasLaterAttempt(userId, completion.completedAt))
  ) {
    return { status: 'ineligible' };
  }
  return { status: 'eligible', completion };
}
