import type { PipelineStage, Types } from 'mongoose';

import { ATTEMPT_AT } from '@/repositories/pipelines/activation-funnel';
import { utcWeekStart } from '@/repositories/pipelines/activation-stages';

const DAY_MS = 86_400_000;
/** The activation window after a send (RIN-998): `[sentAt, sentAt + 7 d)`. */
export const ACTIVATION_EMAIL_WINDOW_MS = 7 * DAY_MS;

/** An adaptive completion of a web learner, injected as a literal. */
export interface AdaptiveCompletionLiteral {
  uid: Types.ObjectId;
  at: Date;
}

interface ActivationEmailPipelineInput {
  from: Date;
  to: Date;
  excludedUserIds: readonly Types.ObjectId[];
  attemptsCollection: string;
  adaptive: readonly AdaptiveCompletionLiteral[];
}

const countWhen = (condition: unknown) => ({ $sum: { $cond: [condition, 1, 0] } });

/** Whether an injected adaptive completion of `$uid` falls in the window. */
function adaptiveHit(adaptive: readonly AdaptiveCompletionLiteral[], windowEnd: unknown): unknown {
  if (adaptive.length === 0) return false;
  const inWindow = {
    $filter: {
      input: { $literal: [...adaptive] },
      cond: {
        $and: [
          { $eq: ['$$this.uid', '$uid'] },
          { $gte: ['$$this.at', '$sentAt'] },
          { $lt: ['$$this.at', windowEnd] },
        ],
      },
    },
  };
  return { $gt: [{ $size: inWindow }, 0] };
}

/**
 * Sent activation nudges by UTC send week and trigger (RIN-1001).
 *
 * A send is a `completed` `activation_nudge` outbox row; its send time is
 * `availableAt`, the slot the worker claimed it in (a retry moves the slot, so
 * it is the slot of the delivery that succeeded). The match is served by
 * `EmailOutbox {status, availableAt, leaseUntil}`.
 *
 * Activated within 7 days: an attempt of that learner at its effective time
 * (`claimedAt`, else `takenAt`) in `[sentAt, sentAt + 7 d)`, found by one
 * `$lookup` per send on `Attempt {user, takenAt}` and stopped at the first
 * hit, or an injected adaptive completion in the same window. The nudge is
 * only sent to learners with no completion (re-checked at send time), so a
 * completion in the window is their first.
 */
export function activationEmailPipeline(input: ActivationEmailPipelineInput): PipelineStage[] {
  const windowEnd = { $add: ['$sentAt', ACTIVATION_EMAIL_WINDOW_MS] };
  return [
    {
      $match: {
        status: 'completed',
        availableAt: { $gte: input.from, $lt: input.to },
        kind: 'activation_nudge',
        userId: { $type: 'objectId', $nin: [...input.excludedUserIds] },
      },
    },
    {
      $project: {
        _id: 0,
        uid: '$userId',
        sentAt: '$availableAt',
        trigger: { $ifNull: ['$trigger', '24h'] },
        clicked: { $ne: [{ $ifNull: ['$clickedAt', null] }, null] },
      },
    },
    {
      $lookup: {
        from: input.attemptsCollection,
        localField: 'uid',
        foreignField: 'user',
        let: { sentAt: '$sentAt' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $gte: [ATTEMPT_AT, '$$sentAt'] },
                  { $lt: [ATTEMPT_AT, { $add: ['$$sentAt', ACTIVATION_EMAIL_WINDOW_MS] }] },
                ],
              },
            },
          },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ],
        as: 'quizHits',
      },
    },
    {
      $group: {
        _id: { weekStart: utcWeekStart('$sentAt'), trigger: '$trigger' },
        sent: { $sum: 1 },
        clicked: countWhen('$clicked'),
        activatedWithin7d: countWhen({
          $or: [{ $gt: [{ $size: '$quizHits' }, 0] }, adaptiveHit(input.adaptive, windowEnd)],
        }),
      },
    },
    { $sort: { '_id.weekStart': 1, '_id.trigger': 1 } },
  ];
}
