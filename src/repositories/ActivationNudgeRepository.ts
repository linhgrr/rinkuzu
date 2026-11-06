import type { Types } from 'mongoose';

import connectDB from '@/lib/mongoose';
import { isMongoDuplicateKeyError } from '@/lib/mongoose-errors';
import Attempt from '@/models/Attempt';
import {
  EmailOutbox,
  FeedbackOutreachPreference,
  MarketingConsentEvent,
  MarketingContactState,
  MarketingPreference,
} from '@/models/Communication';
import User from '@/models/User';
import { LEARNER_FILTER } from './AdminStatsRepository';

/**
 * Persistence for the one-time activation nudge (RIN-999). Every read is a
 * batch over a handful of user ids and is served by an index:
 * `User {createdAt:-1}`, `Attempt {user, takenAt}`, `EmailOutbox {userId, kind,
 * updatedAt}` and `{dedupeKey}`, `MarketingConsentEvent {userId, topic,
 * createdAt}`, and the unique `userId` of the preference and contact-state
 * collections.
 */

export interface NudgeLearner {
  id: Types.ObjectId;
  email: string;
  name: string | null;
  role: string | null;
  disable: number | null;
  isTestAccount: boolean | null;
  createdAt: Date;
  /** `MarketingPreference.locale`, the only locale an account stores. */
  locale: string | null;
}

/** Per-learner flags that block the email, for a batch of ids. */
export interface NudgeBlockers {
  attempted: ReadonlySet<string>;
  unsubscribed: ReadonlySet<string>;
  nudged: ReadonlySet<string>;
}

export interface NudgeRow {
  dedupeKey: string;
  userId: Types.ObjectId;
  to: string;
  from: string;
  locale: string;
  trigger: '24h' | 'backfill';
  availableAt: Date;
  /** Insert the row already canceled, so later sweeps skip the account. */
  canceledReason?: string;
}

interface UserRecord {
  _id: Types.ObjectId;
  email: string;
  name?: string;
  role?: string;
  disable?: number;
  isTestAccount?: boolean;
  createdAt: Date;
}

const USER_FIELDS = '_id email name role disable isTestAccount createdAt';
/** Body stored at enqueue time; the real email is rendered at send time. */
const DEFERRED_BODY = 'Rendered at send time (activation_nudge).';

function idSet(ids: readonly unknown[]): Set<string> {
  return new Set(ids.filter((id) => id != null).map((id) => String(id)));
}

export class ActivationNudgeRepository {
  private static async withLocales(users: UserRecord[]): Promise<NudgeLearner[]> {
    const preferences = await MarketingPreference.find(
      { userId: { $in: users.map((user) => user._id) } },
      { userId: 1, locale: 1 },
    ).lean<{ userId: Types.ObjectId; locale?: string | null }[]>();
    const locales = new Map(preferences.map((row) => [row.userId.toString(), row.locale ?? null]));
    return users.map((user) => ({
      id: user._id,
      email: user.email,
      name: user.name ?? null,
      role: user.role ?? null,
      disable: user.disable ?? null,
      isTestAccount: user.isTestAccount ?? null,
      createdAt: user.createdAt,
      locale: locales.get(user._id.toString()) ?? null,
    }));
  }

  /** Non-excluded learners who signed up in `(after, until]`, oldest first. */
  async learnersSignedUpBetween(after: Date, until: Date, limit: number): Promise<NudgeLearner[]> {
    await connectDB();
    const users = await User.find({ createdAt: { $gt: after, $lte: until }, ...LEARNER_FILTER })
      .select(USER_FIELDS)
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean<UserRecord[]>();
    return users.length === 0 ? [] : ActivationNudgeRepository.withLocales(users);
  }

  async findLearner(userId: Types.ObjectId): Promise<NudgeLearner | null> {
    await connectDB();
    const user = await User.findById(userId).select(USER_FIELDS).lean<UserRecord | null>();
    if (!user) return null;
    const [learner] = await ActivationNudgeRepository.withLocales([user]);
    return learner ?? null;
  }

  /**
   * Which of these learners have a completed attempt, have unsubscribed from
   * any Rinkuzu email, or already have an activation-nudge row. `exceptOutboxId`
   * leaves out the row being sent.
   */
  async blockers(
    userIds: readonly Types.ObjectId[],
    exceptOutboxId?: Types.ObjectId,
  ): Promise<NudgeBlockers> {
    const ids = [...userIds];
    const [attempted, optedOut, undeliverable, feedbackOptOut, nudged] = await Promise.all([
      Attempt.distinct('user', { user: { $in: ids } }),
      MarketingConsentEvent.distinct('userId', { userId: { $in: ids }, action: 'opt_out' }),
      MarketingContactState.distinct('userId', {
        userId: { $in: ids },
        status: { $ne: 'deliverable' },
      }),
      FeedbackOutreachPreference.distinct('userId', {
        userId: { $in: ids },
        optedOutAt: { $ne: null },
      }),
      EmailOutbox.distinct('userId', {
        userId: { $in: ids },
        kind: 'activation_nudge',
        ...(exceptOutboxId ? { _id: { $ne: exceptOutboxId } } : {}),
      }),
    ]);
    return {
      attempted: idSet(attempted),
      unsubscribed: idSet([...optedOut, ...undeliverable, ...feedbackOptOut]),
      nudged: idSet(nudged),
    };
  }

  /**
   * Inserts the account's one row. A second sweep, a retry or a concurrent
   * insert is a no-op: the row is matched on its unique dedupe key and never
   * rewritten. True when this call inserted it.
   */
  async enqueue(row: NudgeRow): Promise<boolean> {
    try {
      const result = await EmailOutbox.updateOne(
        { dedupeKey: row.dedupeKey },
        {
          $setOnInsert: {
            dedupeKey: row.dedupeKey,
            kind: 'activation_nudge',
            entityType: 'user',
            entityId: row.userId,
            userId: row.userId,
            to: row.to,
            from: row.from,
            replyTo: null,
            subject: 'activation_nudge',
            html: DEFERRED_BODY,
            text: DEFERRED_BODY,
            references: [],
            status: row.canceledReason ? 'canceled' : 'pending',
            ...(row.canceledReason ? { lastError: row.canceledReason } : {}),
            availableAt: row.availableAt,
            attempts: 0,
            trigger: row.trigger,
            locale: row.locale,
          },
        },
        { upsert: true },
      );
      return result.upsertedCount === 1;
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) return false;
      throw error;
    }
  }

  /**
   * Stamps the first CTA click on the account's nudge row. True only for the
   * click that set it; later clicks, and accounts without a sent row, are no-ops.
   * Served by the unique `{dedupeKey}` index.
   */
  async recordClick(dedupeKey: string, at: Date): Promise<boolean> {
    await connectDB();
    const result = await EmailOutbox.updateOne(
      { dedupeKey, kind: 'activation_nudge', status: 'completed', clickedAt: null },
      { $set: { clickedAt: at } },
    );
    return result.modifiedCount === 1;
  }
}
