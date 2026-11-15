import type { PipelineStage } from 'mongoose';

import type {
  GuestFunnelWeekRecord,
  IGuestFunnelStatsRepository,
} from '@/interfaces/repositories/IGuestFunnelStatsRepository';
import connectDB from '@/lib/mongoose';
import AttemptModel from '@/models/Attempt';
import { MarketingConsentEvent } from '@/models/Communication';
import { AdminStatsRepository } from '@/repositories/AdminStatsRepository';
import { utcWeekStart } from '@/repositories/pipelines/activation-stages';

const CLAIM_WINDOW_MS = 7 * 86_400_000;

interface AttemptWeekRow {
  _id: Date;
  completed: number;
  claimed7d: number;
}

interface OptInWeekRow {
  _id: Date;
  count: number;
}

/**
 * Guest attempts by `takenAt` week: still-unclaimed ones (they carry a token
 * hash) and claimed ones (`claimedAt`). `Attempt {takenAt}` serves the range;
 * the owner filter then runs on that window only. Attempts claimed into an
 * excluded account drop out; an unclaimed attempt has `user: null`.
 */
export function guestAttemptWeeksPipeline(
  from: Date,
  to: Date,
  excludedUserIds: readonly unknown[],
): PipelineStage[] {
  return [
    {
      $match: {
        takenAt: { $gte: from, $lt: to },
        $or: [{ guestClaimTokenHash: { $type: 'string' } }, { claimedAt: { $type: 'date' } }],
        user: { $nin: [...excludedUserIds] },
      },
    },
    {
      $group: {
        _id: utcWeekStart('$takenAt'),
        completed: { $sum: 1 },
        claimed7d: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: [{ $type: '$claimedAt' }, 'date'] },
                  { $lte: [{ $subtract: ['$claimedAt', '$takenAt'] }, CLAIM_WINDOW_MS] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ];
}

export function guestOptInWeeksPipeline(
  from: Date,
  to: Date,
  excludedUserIds: readonly unknown[],
): PipelineStage[] {
  return [
    {
      $match: {
        createdAt: { $gte: from, $lt: to },
        source: 'guest_result_review',
        action: 'opt_in',
        userId: { $nin: [...excludedUserIds] },
      },
    },
    { $group: { _id: utcWeekStart('$createdAt'), count: { $sum: 1 } } },
  ];
}

/** Guest funnel aggregates for `/admin/stats` (RIN-1711). */
export class GuestFunnelStatsRepository implements IGuestFunnelStatsRepository {
  async getWeeklyGuestFunnel(from: Date, to: Date): Promise<GuestFunnelWeekRecord[]> {
    await connectDB();
    const excluded = await AdminStatsRepository.excludedUserIds();
    const [attempts, optIns] = await Promise.all([
      AttemptModel.aggregate<AttemptWeekRow>(guestAttemptWeeksPipeline(from, to, excluded)),
      MarketingConsentEvent.aggregate<OptInWeekRow>(guestOptInWeeksPipeline(from, to, excluded)),
    ]);
    const weeks = new Map<number, GuestFunnelWeekRecord>();
    for (const row of attempts) {
      weeks.set(row._id.getTime(), {
        weekStart: row._id,
        guestCompleted: row.completed,
        guestClaimed7d: row.claimed7d,
        reviewOptInFromGuest: 0,
      });
    }
    for (const row of optIns) {
      const existing = weeks.get(row._id.getTime());
      weeks.set(row._id.getTime(), {
        weekStart: row._id,
        guestCompleted: existing?.guestCompleted ?? 0,
        guestClaimed7d: existing?.guestClaimed7d ?? 0,
        reviewOptInFromGuest: row.count,
      });
    }
    return [...weeks.values()];
  }
}
