import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';

import connectDB from '@/lib/mongoose';
import { hashGuestClaimToken } from '@/lib/guest-claim-token';
import { AdminStatsRepository } from '@/repositories/AdminStatsRepository';
import { AttemptRepository } from '@/repositories/AttemptRepository';
import { DashboardRepository } from '@/repositories/DashboardRepository';
import { QuizAttemptProgressRepository } from '@/repositories/QuizAttemptProgressRepository';
import { GuestAttemptClaimService } from '@/services/quiz/GuestAttemptClaimService';
import { integrationDatabaseUri } from '../../setup/integration-db';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** RIN-920: claiming guest attempts after sign-up, and the activation credit at `claimedAt`. */
describe('guest attempt claim', () => {
  const runId = `claim-${randomUUID()}`;
  const newToken = () => randomBytes(32).toString('base64url');
  const at = (iso: string) => new Date(iso);
  const progressUserIds: string[] = [];

  function guestAttempt(token: string, takenAt: Date, extra: Record<string, unknown> = {}) {
    return {
      _id: new Types.ObjectId(),
      _integrationRun: runId,
      guestClaimTokenHash: hashGuestClaimToken(token),
      quiz: new Types.ObjectId(),
      quizSnapshot: {
        integrity: 'complete',
        title: 'Fake quiz',
        slug: `${runId}-quiz`,
        questions: [],
      },
      answers: [],
      score: 80,
      correctAnswers: 4,
      totalQuestions: 5,
      takenAt,
      ...extra,
    };
  }

  beforeAll(async () => {
    process.env['MONGODB_URI'] = integrationDatabaseUri();
    await connectDB();
  }, 15_000);

  afterAll(async () => {
    const db = mongoose.connection;
    await Promise.all([
      db.collection('attempts').deleteMany({ _integrationRun: runId }),
      db.collection('users').deleteMany({ _integrationRun: runId }),
      db.collection('userprogresses').deleteMany({ userId: { $in: progressUserIds } }),
    ]);
  }, 10_000);

  it('claims each matching token once and drops everything else silently', async () => {
    const db = mongoose.connection;
    const userId = new Types.ObjectId();
    progressUserIds.push(userId.toHexString());
    const now = new Date();
    const tokens = {
      good: newToken(),
      second: newToken(),
      old: newToken(),
      owned: newToken(),
      email: newToken(),
      wrong: newToken(),
    };
    const good = guestAttempt(tokens.good, new Date(now.getTime() - HOUR));
    const second = guestAttempt(tokens.second, new Date(now.getTime() - 2 * HOUR));
    const old = guestAttempt(tokens.old, new Date(now.getTime() - DAY - HOUR));
    // Never valid documents; inserted raw to prove the filter itself refuses them.
    const owned = guestAttempt(tokens.owned, now, { user: new Types.ObjectId() });
    const email = guestAttempt(tokens.email, now, { guestEmail: `${runId}@guest.fixture` });
    await db.collection('attempts').insertMany([good, second, old, owned, email]);

    const service = new GuestAttemptClaimService(new QuizAttemptProgressRepository(), () => now);
    const claimed = await service.claim(userId.toHexString(), [
      tokens.good,
      tokens.wrong,
      tokens.old,
      tokens.owned,
      tokens.email,
      tokens.second,
      tokens.good,
    ]);

    expect(claimed).toEqual([good._id.toHexString(), second._id.toHexString()]);
    const stored = await db.collection('attempts').findOne({ _id: good._id });
    expect(stored).toMatchObject({
      user: userId,
      claimedAt: now,
      score: 80,
      takenAt: good.takenAt,
    });
    expect(stored).not.toHaveProperty('guestClaimTokenHash');
    // Untouched: still unowned, still holding their hash.
    for (const untouched of [old, owned, email]) {
      const record = await db.collection('attempts').findOne({ _id: untouched._id });
      expect(record).toMatchObject({ guestClaimTokenHash: untouched.guestClaimTokenHash });
      expect(record).not.toHaveProperty('claimedAt');
    }
    expect(await db.collection('attempts').findOne({ _id: email._id })).not.toHaveProperty('user');

    // Single use, also for another account.
    await expect(service.claim(userId.toHexString(), [tokens.good])).resolves.toEqual([]);
    await expect(
      service.claim(new Types.ObjectId().toHexString(), [tokens.good, tokens.second]),
    ).resolves.toEqual([]);

    // /history and the "new learner" check see the claimed attempts; the dashboard progress too.
    const history = await new AttemptRepository().findByUser(userId.toHexString(), {
      page: 1,
      limit: 10,
    });
    expect(history.items.map((item) => item.id)).toEqual([
      good._id.toHexString(),
      second._id.toHexString(),
    ]);
    await expect(new DashboardRepository().hasSubmittedAttempt(userId.toHexString())).resolves.toBe(
      true,
    );
    // UserProgress keys on the id string.
    const progress = await db
      .collection('userprogresses')
      .findOne({ userId: userId.toHexString() });
    expect(progress).toMatchObject({ totalQuizzesTaken: 2, totalXp: 80, currentStreak: 1 });
  });

  /** One UTC ISO week, Monday 2100-04-05 to 2100-04-12, far from other suites. */
  it('credits a claimed guest attempt to the signup week at claimedAt', async () => {
    const db = mongoose.connection;
    const weekStart = at('2100-04-05T00:00:00.000Z');
    const weekEnd = at('2100-04-12T00:00:00.000Z');
    const claimer = new Types.ObjectId();
    const unclaimed = new Types.ObjectId();
    const signupAt = at('2100-04-05T09:00:00.000Z');
    const learner = (id: Types.ObjectId) => ({
      _id: id,
      _integrationRun: runId,
      email: `${runId}-${id.toHexString()}@learners.fixture`,
      role: 'user',
      disable: 0,
      authVersion: 0,
      createdAt: signupAt,
      updatedAt: signupAt,
    });
    await db.collection('users').insertMany([learner(claimer), learner(unclaimed)]);
    // Taken the evening before signup (the previous week), claimed right after signup.
    const takenAt = at('2100-04-04T20:00:00.000Z');
    const { guestClaimTokenHash: _hash, ...claimed } = guestAttempt(newToken(), takenAt);
    await db.collection('attempts').insertMany([
      { ...claimed, user: claimer, claimedAt: at('2100-04-05T09:05:00.000Z') },
      // Still a guest's: no account to credit.
      guestAttempt(newToken(), at('2100-04-05T12:00:00.000Z')),
    ]);

    const aggregates = await new AdminStatsRepository().getActivationAggregates(weekStart, weekEnd);

    expect(aggregates.cohorts).toEqual([
      expect.objectContaining({
        weekStart,
        signups: 2,
        material: 1,
        activated: 1,
        activatedBy: { quiz: 1, adaptive: 0, both: 0, claimedGuest: 1 },
        startedQuiz: 1,
      }),
    ]);
    expect(aggregates.firstAttempts).toEqual([
      { weekStart, learners: 1, activatedBy: { quiz: 1, adaptive: 0, both: 0 } },
    ]);
  });
});
