import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';

import connectDB from '@/lib/mongoose';
import { hashGuestClaimToken } from '@/lib/guest-claim-token';
import { AdminStatsRepository } from '@/repositories/AdminStatsRepository';
import { QuizAttemptProgressRepository } from '@/repositories/QuizAttemptProgressRepository';
import { GuestAttemptClaimService } from '@/services/quiz/GuestAttemptClaimService';
import { integrationDatabaseUri } from '../../setup/integration-db';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const at = (iso: string) => new Date(iso);
const plus = (date: Date, ms: number) => new Date(date.getTime() + ms);

/**
 * RIN-1256 (hub: RIN-1417): the entry point stored on attempts (guest ones included), kept by a
 * claim, and the activated-by-entry split of the signup week. One UTC ISO week,
 * Monday 2100-05-03, far from other suites.
 */
describe('activation by entry point', () => {
  const runId = `entry-${randomUUID()}`;
  const weekStart = at('2100-05-03T00:00:00.000Z');
  const weekEnd = at('2100-05-10T00:00:00.000Z');
  const signupAt = at('2100-05-04T08:00:00.000Z');
  const quizId = new Types.ObjectId();
  const keys = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'] as const;
  const ids = Object.fromEntries(keys.map((key) => [key, new Types.ObjectId()])) as Record<
    (typeof keys)[number],
    Types.ObjectId
  >;
  const progressUserIds = [ids.p8.toHexString()];

  function attempt(
    key: (typeof keys)[number],
    takenAt: Date,
    attribution: { entry?: string; post?: string; topic?: string } = {},
  ) {
    return {
      _integrationRun: runId,
      user: ids[key],
      quiz: quizId,
      takenAt,
      score: 60,
      ...attribution,
    };
  }

  function submission(token: string, takenAt: Date, attribution: Record<string, string>) {
    return {
      guestClaimTokenHash: hashGuestClaimToken(token),
      idempotencyKey: randomUUID(),
      quizId: quizId.toHexString(),
      quizSlug: `${runId}-quiz`,
      quizSnapshot: {
        integrity: 'complete' as const,
        title: 'Fake quiz',
        slug: `${runId}-quiz`,
        questions: [
          {
            id: new Types.ObjectId().toHexString(),
            question: 'Fake?',
            options: ['Yes', 'No'],
            type: 'single' as const,
            correctIndex: 0,
          },
        ],
      },
      answers: [0],
      score: 100,
      totalQuestions: 1,
      correctAnswers: 1,
      wrongQuestions: [],
      takenAt,
      ...attribution,
    };
  }

  beforeAll(async () => {
    process.env['MONGODB_URI'] = integrationDatabaseUri();
    await connectDB();
    await mongoose.connection.collection('users').insertMany(
      keys.map((key) => ({
        _id: ids[key],
        _integrationRun: runId,
        email: `${runId}-${key}@learners.fixture`,
        role: 'user',
        disable: 0,
        authVersion: 0,
        createdAt: signupAt,
        updatedAt: signupAt,
      })),
    );
  }, 15_000);

  afterAll(async () => {
    const db = mongoose.connection;
    await Promise.all([
      db.collection('attempts').deleteMany({ _integrationRun: runId }),
      db.collection('attempts').deleteMany({ quiz: quizId }),
      db.collection('users').deleteMany({ _integrationRun: runId }),
      db.collection('userprogresses').deleteMany({ userId: { $in: progressUserIds } }),
      db.collection('questionprogresses').deleteMany({ userId: { $in: progressUserIds } }),
    ]);
  }, 10_000);

  it('stores entry and post on a guest attempt, keeps them through the claim, and splits activation by them', async () => {
    const db = mongoose.connection;
    const repository = new QuizAttemptProgressRepository();

    // A guest submit through the real schema: both fields persist.
    const token = randomBytes(32).toString('base64url');
    const guestTakenAt = plus(signupAt, -HOUR);
    const recorded = await repository.recordSubmittedAttempt(
      submission(token, guestTakenAt, { entry: 'activation_email' }),
    );
    const blogToken = randomBytes(32).toString('base64url');
    const blogGuest = await repository.recordSubmittedAttempt(
      submission(blogToken, plus(signupAt, -HOUR), { entry: 'blog', post: 'on-thi-toeic' }),
    );
    expect(
      await db.collection('attempts').findOne({ _id: new Types.ObjectId(blogGuest.id) }),
    ).toMatchObject({ entry: 'blog', post: 'on-thi-toeic' });
    // RIN-1417: a hub card's topic slug persists next to entry=hub.
    const hubGuest = await repository.recordSubmittedAttempt(
      submission(randomBytes(32).toString('base64url'), plus(signupAt, -HOUR), {
        entry: 'hub',
        topic: 'tieng-anh-lop-10',
      }),
    );
    expect(
      await db.collection('attempts').findOne({ _id: new Types.ObjectId(hubGuest.id) }),
    ).toMatchObject({ entry: 'hub', topic: 'tieng-anh-lop-10' });

    // P8 claims the activation-email guest attempt right after signup.
    const claimedAt = plus(signupAt, 30 * 60_000);
    const claimed = await new GuestAttemptClaimService(repository, () => claimedAt).claim(
      ids.p8.toHexString(),
      [token],
    );
    expect(claimed).toEqual([recorded.id]);
    const stored = await db
      .collection('attempts')
      .findOne({ _id: new Types.ObjectId(recorded.id) });
    expect(stored).toMatchObject({ user: ids.p8, claimedAt, entry: 'activation_email' });

    await db.collection('attempts').insertMany([
      // P1: first attempt from a blog post; a later landing attempt does not change it.
      attempt('p1', plus(signupAt, DAY), { entry: 'blog', post: 'post-a' }),
      attempt('p1', plus(signupAt, 2 * DAY), { entry: 'landing' }),
      // P2: landing first, blog later → landing.
      attempt('p2', plus(signupAt, HOUR), { entry: 'landing' }),
      attempt('p2', plus(signupAt, 3 * DAY), { entry: 'blog', post: 'post-b' }),
      attempt('p3', plus(signupAt, 2 * HOUR), { entry: 'blog', post: 'post-a' }),
      attempt('p4', plus(signupAt, 3 * HOUR), { entry: 'blog', post: 'post-b' }),
      // P5: an attempt from before RIN-1256, no entry → none.
      attempt('p5', plus(signupAt, 4 * HOUR)),
      // P6: from the blog but on day 7 exactly → not activated, not counted.
      attempt('p6', plus(signupAt, 7 * DAY), { entry: 'blog', post: 'post-c' }),
      // P9: first attempt from a topic hub card → hub (RIN-1417).
      attempt('p9', plus(signupAt, 5 * HOUR), { entry: 'hub', topic: 'tieng-anh-lop-10' }),
    ]);
    // P7: activated by an adaptive completion only → none.
    const adaptive = [
      {
        userId: ids.p7.toHexString(),
        firstCompletionAt: plus(signupAt, DAY),
        completions: [plus(signupAt, DAY)],
        succeededUploads: [plus(signupAt, HOUR)],
      },
    ];

    const aggregates = await new AdminStatsRepository().getActivationAggregates(
      weekStart,
      weekEnd,
      adaptive,
    );

    expect(aggregates.cohorts).toEqual([
      expect.objectContaining({ weekStart, signups: 9, activated: 8 }),
    ]);
    expect(aggregates.cohortEntries).toEqual([
      {
        weekStart,
        activatedByEntry: {
          blog: 3,
          landing: 1,
          post_signin_starter: 0,
          activation_email: 1,
          hub: 1,
          none: 2,
        },
        blogPosts: [
          { post: 'post-a', activated: 2 },
          { post: 'post-b', activated: 1 },
        ],
      },
    ]);
  });
});
