import { randomUUID } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GuestFunnelStatsRepository } from '@/repositories/GuestFunnelStatsRepository';
import { integrationDatabaseUri } from '../../setup/integration-db';

/**
 * Guest funnel counts (RIN-1711). Every timestamp is in January 2001 (ISO
 * 2001-W01 starts Monday 2001-01-01) so the counts are exact on a shared database.
 */
const DAY = 86_400_000;
const at = (iso: string) => new Date(iso);
const W01 = at('2001-01-01T00:00:00.000Z');
const W02 = at('2001-01-08T00:00:00.000Z');
const W03 = at('2001-01-15T00:00:00.000Z');

describe('guest funnel stats integration', () => {
  const runId = `guest-funnel-${randomUUID()}`;
  const learner = new Types.ObjectId();
  const internal = new Types.ObjectId();
  const quiz = new Types.ObjectId();

  const guestAttempt = (takenAt: Date, extra: Record<string, unknown>) => ({
    _integrationRun: runId,
    quiz,
    takenAt,
    score: 50,
    ...extra,
  });

  beforeAll(async () => {
    await mongoose.connect(integrationDatabaseUri(), { serverSelectionTimeoutMS: 2_000 });
    const db = mongoose.connection;
    await db.collection('users').insertMany([
      {
        _id: learner,
        _integrationRun: runId,
        email: `${runId}-learner@learners.fixture`,
        role: 'user',
        disable: 0,
      },
      {
        _id: internal,
        _integrationRun: runId,
        email: `${runId}-internal@learners.fixture`,
        role: 'user',
        disable: 0,
        isTestAccount: true,
      },
    ]);
    await db.collection('attempts').insertMany([
      // W01: still unclaimed, claimed in 2 days, claimed in 9 days, claimed by an internal account.
      guestAttempt(new Date(W01.getTime() + DAY), { guestClaimTokenHash: `${runId}-a` }),
      guestAttempt(new Date(W01.getTime() + DAY), {
        user: learner,
        claimedAt: new Date(W01.getTime() + 3 * DAY),
      }),
      guestAttempt(new Date(W01.getTime() + 2 * DAY), {
        user: learner,
        claimedAt: new Date(W01.getTime() + 11 * DAY),
      }),
      guestAttempt(new Date(W01.getTime() + 2 * DAY), {
        user: internal,
        claimedAt: new Date(W01.getTime() + 3 * DAY),
      }),
      // A signed-in attempt is not a guest attempt.
      guestAttempt(new Date(W01.getTime() + 2 * DAY), { user: learner }),
      // W02: one claimed within the hour.
      guestAttempt(new Date(W02.getTime() + DAY), {
        user: learner,
        claimedAt: new Date(W02.getTime() + DAY + 3_600_000),
      }),
    ]);
    await db.collection('marketingconsentevents').insertMany([
      {
        _integrationRun: runId,
        userId: learner,
        topic: 'study_reminders',
        action: 'opt_in',
        source: 'guest_result_review',
        createdAt: new Date(W02.getTime() + DAY),
      },
      {
        _integrationRun: runId,
        userId: internal,
        topic: 'study_reminders',
        action: 'opt_in',
        source: 'guest_result_review',
        createdAt: new Date(W02.getTime() + DAY),
      },
      {
        _integrationRun: runId,
        userId: learner,
        topic: 'study_reminders',
        action: 'opt_in',
        source: 'result_page_review',
        createdAt: new Date(W02.getTime() + DAY),
      },
    ]);
  }, 15_000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 1) return;
    const db = mongoose.connection;
    await Promise.all(
      ['users', 'attempts', 'marketingconsentevents'].map((name) =>
        db.collection(name).deleteMany({ _integrationRun: runId }),
      ),
    );
    await mongoose.disconnect();
  }, 10_000);

  it('counts guest attempts, 7-day claims and guest opt-ins per week, without internal accounts', async () => {
    const weeks = await new GuestFunnelStatsRepository().getWeeklyGuestFunnel(W01, W03);
    const byWeek = new Map(weeks.map((row) => [row.weekStart.getTime(), row]));

    expect(byWeek.get(W01.getTime())).toMatchObject({
      guestCompleted: 3,
      guestClaimed7d: 1,
      reviewOptInFromGuest: 0,
    });
    expect(byWeek.get(W02.getTime())).toMatchObject({
      guestCompleted: 1,
      guestClaimed7d: 1,
      reviewOptInFromGuest: 1,
    });
  });
});
