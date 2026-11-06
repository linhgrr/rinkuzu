import type {
  IReviewEmailStatsRepository,
  ReviewEmailConsentWeek,
  ReviewEmailSendWeek,
  ReviewEmailWeeklyCounts,
} from '@/interfaces/repositories/IReviewEmailStatsRepository';
import connectDB from '@/lib/mongoose';
import { EmailOutbox, MarketingConsentEvent, WebhookEvent } from '@/models/Communication';
import { AdminStatsRepository } from '@/repositories/AdminStatsRepository';
import { utcWeekStart } from '@/repositories/pipelines/activation-stages';

interface SendWeekRow {
  _id: Date;
  sent: number;
  opened: number;
}

interface ConsentWeekRow {
  _id: Date;
  optIns: number;
  unsubscribed: number;
}

const countWhen = (condition: unknown) => ({ $sum: { $cond: [condition, 1, 0] } });

/**
 * Week-1 review email aggregates (RIN-916). Sends are completed
 * `review_reminder` outbox rows bucketed by `availableAt` (the send slot) and
 * served by `{status, availableAt}`; consent events by `createdAt`. Both drop
 * the analytics-excluded accounts and the QA recipients.
 */
export class ReviewEmailStatsRepository implements IReviewEmailStatsRepository {
  async getWeeklyCounts(
    from: Date,
    to: Date,
    qaEmails: readonly string[],
  ): Promise<ReviewEmailWeeklyCounts> {
    await connectDB();
    const excluded = await AdminStatsRepository.excludedUserIds(qaEmails);
    const [sends, consents, openEvent] = await Promise.all([
      EmailOutbox.aggregate<SendWeekRow>([
        {
          $match: {
            status: 'completed',
            availableAt: { $gte: from, $lt: to },
            kind: 'review_reminder',
            userId: { $nin: excluded },
            to: { $nin: [...qaEmails] },
          },
        },
        {
          $group: {
            _id: utcWeekStart('$availableAt'),
            sent: { $sum: 1 },
            opened: countWhen({ $ne: [{ $ifNull: ['$openedAt', null] }, null] }),
          },
        },
      ]),
      MarketingConsentEvent.aggregate<ConsentWeekRow>([
        {
          $match: {
            createdAt: { $gte: from, $lt: to },
            topic: 'study_reminders',
            userId: { $nin: excluded },
          },
        },
        {
          $group: {
            _id: utcWeekStart('$createdAt'),
            optIns: countWhen({
              $and: [{ $eq: ['$action', 'opt_in'] }, { $eq: ['$source', 'result_page_review'] }],
            }),
            unsubscribed: countWhen({
              $and: [{ $eq: ['$action', 'opt_out'] }, { $eq: ['$source', 'unsubscribe'] }],
            }),
          },
        },
      ]),
      WebhookEvent.exists({ eventType: 'email.opened' }),
    ]);
    return {
      sends: sends.map(
        (row): ReviewEmailSendWeek => ({ weekStart: row._id, sent: row.sent, opened: row.opened }),
      ),
      consents: consents.map(
        (row): ReviewEmailConsentWeek => ({
          weekStart: row._id,
          optIns: row.optIns,
          unsubscribed: row.unsubscribed,
        }),
      ),
      opensTracked: openEvent !== null,
    };
  }
}
