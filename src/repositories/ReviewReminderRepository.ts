import { Types } from 'mongoose';

import connectDB from '@/lib/mongoose';
import { isMongoDuplicateKeyError } from '@/lib/mongoose-errors';
import Attempt from '@/models/Attempt';
import { EmailOutbox, MarketingConsentEvent, MarketingPreference } from '@/models/Communication';
import Quiz from '@/models/Quiz';
import User from '@/models/User';

/**
 * Persistence for the opt-in 2-day review email (RIN-915): the
 * `study_reminders` preference and consent events, `review_reminder` outbox
 * rows, and the facts the send-time eligibility check reads. Every query is
 * per learner and served by an index: `Attempt {user, takenAt}`,
 * `EmailOutbox {dedupeKey}` and `{userId, kind, updatedAt}`,
 * `MarketingPreference {userId}`.
 */

export interface ReminderAttempt {
  id: Types.ObjectId;
  userId: Types.ObjectId | null;
  quizId: Types.ObjectId;
  takenAt: Date;
  correctAnswers: number;
  totalQuestions: number;
}

export interface ReminderRecipient {
  email: string;
  role?: string;
  disable?: number;
  isTestAccount?: boolean;
}

export interface ReminderPreference {
  studyReminders?: boolean;
  locale?: string | null;
}

export interface ReminderQuiz {
  slug: string;
  title: string;
}

export interface ReminderSendFacts {
  user: ReminderRecipient | null;
  preference: ReminderPreference | null;
  laterAttempt: boolean;
  sentInLastWeek: boolean;
  quiz: ReminderQuiz | null;
}

export interface ReminderRowState {
  status: string;
  availableAt: Date;
}

export interface ReminderUpsertConflict {
  conflict: ReminderRowState;
}

export interface ReminderConsentEvent {
  userId: Types.ObjectId;
  action: 'opt_in' | 'opt_out';
  source: 'result_page_review' | 'unsubscribe';
  ipHash: string | null;
}

export interface OwnedReminderAttempt extends ReminderAttempt {
  userId: Types.ObjectId;
}

export interface ReminderSendFactsQuery {
  outboxId: Types.ObjectId;
  attempt: OwnedReminderAttempt;
  capSince: Date;
}

export interface PendingReminderRow {
  dedupeKey: string;
  attemptId: Types.ObjectId;
  userId: Types.ObjectId;
  to: string;
  from: string;
  body: string;
  availableAt: Date;
}

export type ReminderUpsertResult = 'scheduled' | ReminderUpsertConflict;

interface AttemptRecord {
  _id: Types.ObjectId;
  user?: Types.ObjectId;
  quiz: Types.ObjectId;
  takenAt: Date;
  correctAnswers: number;
  totalQuestions: number;
}

export class ReviewReminderRepository {
  async findAttempt(attemptId: Types.ObjectId): Promise<ReminderAttempt | null> {
    await connectDB();
    const attempt = await Attempt.findById(attemptId)
      .select('user quiz takenAt correctAnswers totalQuestions')
      .lean<AttemptRecord | null>();
    if (!attempt) return null;
    return {
      id: attempt._id,
      userId: attempt.user ?? null,
      quizId: attempt.quiz,
      takenAt: attempt.takenAt,
      correctAnswers: attempt.correctAnswers,
      totalQuestions: attempt.totalQuestions,
    };
  }

  /** Ticks `studyReminders`; true when it was already ticked before this write. */
  async optIn(userId: Types.ObjectId, locale: string, now: Date): Promise<boolean> {
    const previous = await MarketingPreference.findOneAndUpdate(
      { userId },
      { $set: { studyReminders: true, locale } },
      { upsert: true, new: false },
    ).lean<{ studyReminders?: boolean } | null>();
    const wasOptedIn = previous?.studyReminders === true;
    if (!wasOptedIn) {
      await MarketingPreference.updateOne({ userId }, { $set: { studyRemindersOptedInAt: now } });
    }
    return wasOptedIn;
  }

  /** Un-ticks `studyReminders`; true when this write changed it. */
  async optOut(userId: Types.ObjectId): Promise<boolean> {
    await connectDB();
    const previous = await MarketingPreference.findOneAndUpdate(
      { userId, studyReminders: true },
      { $set: { studyReminders: false } },
      { new: false },
    ).lean<{ studyReminders?: boolean } | null>();
    return previous?.studyReminders === true;
  }

  async recordConsent(event: ReminderConsentEvent): Promise<void> {
    await MarketingConsentEvent.create({ ...event, topic: 'study_reminders' });
  }

  /**
   * Inserts or re-points the pending row of the learner's 7-day bucket. A row
   * already being sent, sent or dead in that bucket is reported as a conflict.
   */
  async upsertPending(row: PendingReminderRow): Promise<ReminderUpsertResult> {
    try {
      await EmailOutbox.updateOne(
        { dedupeKey: row.dedupeKey, status: { $in: ['pending', 'canceled'] } },
        {
          $set: {
            kind: 'review_reminder',
            entityType: 'attempt',
            entityId: row.attemptId,
            userId: row.userId,
            to: row.to,
            from: row.from,
            replyTo: null,
            subject: 'review_reminder',
            html: row.body,
            text: row.body,
            status: 'pending',
            availableAt: row.availableAt,
            attempts: 0,
            lastError: null,
          },
          $setOnInsert: { dedupeKey: row.dedupeKey, references: [] },
        },
        { upsert: true },
      );
      return 'scheduled';
    } catch (error) {
      if (!isMongoDuplicateKeyError(error)) throw error;
      const existing = await EmailOutbox.findOne({ dedupeKey: row.dedupeKey })
        .select('status availableAt')
        .lean<ReminderRowState | null>();
      return { conflict: existing ?? { status: 'completed', availableAt: row.availableAt } };
    }
  }

  async cancelPending(userId: Types.ObjectId, reason: string): Promise<number> {
    const result = await EmailOutbox.updateMany(
      { userId, kind: 'review_reminder', status: 'pending' },
      { $set: { status: 'canceled', lastError: reason } },
    );
    return result.modifiedCount;
  }

  async sendFacts(input: ReminderSendFactsQuery): Promise<ReminderSendFacts> {
    const { userId } = input.attempt;
    const [user, preference, laterAttempt, sentInLastWeek, quiz] = await Promise.all([
      User.findById(userId)
        .select('email role disable isTestAccount')
        .lean<ReminderRecipient | null>(),
      MarketingPreference.findOne({ userId })
        .select('studyReminders locale')
        .lean<ReminderPreference | null>(),
      Attempt.exists({ user: userId, takenAt: { $gt: input.attempt.takenAt } }),
      EmailOutbox.exists({
        userId,
        kind: 'review_reminder',
        status: 'completed',
        updatedAt: { $gte: input.capSince },
        _id: { $ne: input.outboxId },
      }),
      Quiz.findById(input.attempt.quizId).select('slug title').lean<ReminderQuiz | null>(),
    ]);
    return {
      user,
      preference,
      laterAttempt: laterAttempt !== null,
      sentInLastWeek: sentInLastWeek !== null,
      quiz,
    };
  }
}
