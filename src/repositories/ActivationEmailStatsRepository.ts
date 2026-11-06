import { Types } from 'mongoose';

import type {
  ActivationEmailTrigger,
  ActivationEmailWeekRecord,
  IActivationEmailStatsRepository,
} from '@/interfaces/repositories/IActivationEmailStatsRepository';
import type { AdminAdaptiveLearnerEvents } from '@/interfaces/repositories/IAdminStatsRepository';
import connectDB from '@/lib/mongoose';
import AttemptModel from '@/models/Attempt';
import { EmailOutbox } from '@/models/Communication';
import { AdminStatsRepository } from '@/repositories/AdminStatsRepository';
import {
  ACTIVATION_EMAIL_WINDOW_MS,
  activationEmailPipeline,
  type AdaptiveCompletionLiteral,
} from '@/repositories/pipelines/activation-email';

interface SendWeekKey {
  weekStart: Date;
  trigger: string;
}

interface SendWeekRow {
  _id: SendWeekKey;
  sent: number;
  clicked: number;
  activatedWithin7d: number;
}

const OBJECT_ID_HEX = /^[a-f0-9]{24}$/i;

/**
 * Adaptive completions that can fall in some send's window, `[from, to + 7 d)`.
 * Ids that are not ObjectIds have no web account, so no nudge either.
 */
function adaptiveCompletionLiterals(
  adaptive: readonly AdminAdaptiveLearnerEvents[],
  from: Date,
  to: Date,
): AdaptiveCompletionLiteral[] {
  const until = to.getTime() + ACTIVATION_EMAIL_WINDOW_MS;
  return adaptive
    .filter((events) => OBJECT_ID_HEX.test(events.userId))
    .flatMap((events) =>
      events.completions
        .filter((at) => at.getTime() >= from.getTime() && at.getTime() < until)
        .map((at) => ({ uid: new Types.ObjectId(events.userId), at })),
    );
}

function toTrigger(value: string): ActivationEmailTrigger {
  return value === 'backfill' ? 'backfill' : '24h';
}

/** Activation-nudge aggregates for `/admin/stats` (RIN-1001). */
export class ActivationEmailStatsRepository implements IActivationEmailStatsRepository {
  async getWeeklySends(
    from: Date,
    to: Date,
    adaptive: readonly AdminAdaptiveLearnerEvents[],
  ): Promise<ActivationEmailWeekRecord[]> {
    await connectDB();
    const excludedUserIds = await AdminStatsRepository.excludedUserIds();
    const rows = await EmailOutbox.aggregate<SendWeekRow>(
      activationEmailPipeline({
        from,
        to,
        excludedUserIds,
        attemptsCollection: AttemptModel.collection.name,
        adaptive: adaptiveCompletionLiterals(adaptive, from, to),
      }),
    );
    return rows.map((row) => ({
      weekStart: row._id.weekStart,
      trigger: toTrigger(row._id.trigger),
      sent: row.sent,
      clicked: row.clicked,
      activatedWithin7d: row.activatedWithin7d,
    }));
  }
}
