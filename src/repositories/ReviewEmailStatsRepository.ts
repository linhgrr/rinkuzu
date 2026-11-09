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
  sentD5: number;
  openedD5: number;
}

interface ConsentWeekRow {
  _id: Date;
  optIns: number;
  unsubscribed: number;
}

/** Campaign of the w1-review email; consent events without one are its own (RIN-1044). */
const REVIEW_REMINDER_CAMPAIGN = 'w1-review';

const countWhen = (condition: unknown) => ({ $sum: { $cond: [condition, 1, 0] } });
const isKind = (kind: string) => ({ $eq: ['$kind', kind] });
const isOpened = { $ne: [{ $ifNull: ['$openedAt', null] }, null] };

/**
 * Week-1 review email aggregates (RIN-916). Sends are completed
 * `review_reminder` (d2) and `review_reminder_d5` (RIN-1304) outbox rows,
 * counted per touch and bucketed by `availableAt` (the send slot) and
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
            kind: { $in: ['review_reminder', 'review_reminder_d5'] },
            userId: { $nin: excluded },
            to: { $nin: [...qaEmails] },
          },
        },
        {
          $group: {
            _id: utcWeekStart('$availableAt'),
            sent: countWhen(isKind('review_reminder')),
            opened: countWhen({ $and: [isKind('review_reminder'), isOpened] }),
            sentD5: countWhen(isKind('review_reminder_d5')),
            openedD5: countWhen({ $and: [isKind('review_reminder_d5'), isOpened] }),
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
            // Both prompts: the quiz result page and the adaptive end screen (RIN-1364).
            optIns: countWhen({
              $and: [
                { $eq: ['$action', 'opt_in'] },
                {
                  $or: [
                    { $eq: ['$source', 'result_page_review'] },
                    { $eq: ['$source', 'adaptive_end_review'] },
                  ],
                },
              ],
            }),
            unsubscribed: countWhen({
              $and: [
                { $eq: ['$action', 'opt_out'] },
                { $eq: ['$source', 'unsubscribe'] },
                // Activation-nudge links carry a campaign (RIN-1044); events
                // without one are the review email's, as before.
                {
                  $eq: [
                    { $ifNull: ['$campaign', REVIEW_REMINDER_CAMPAIGN] },
                    REVIEW_REMINDER_CAMPAIGN,
                  ],
                },
              ],
            }),
          },
        },
      ]),
      WebhookEvent.exists({ eventType: 'email.opened' }),
    ]);
    return {
      sends: sends.map(
        (row): ReviewEmailSendWeek => ({
          weekStart: row._id,
          sent: row.sent,
          opened: row.opened,
          sentD5: row.sentD5,
          openedD5: row.openedD5,
        }),
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
