import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';

import connectDB from '@/lib/mongoose';
import { hashGuestClaimToken } from '@/lib/guest-claim-token';
import { AdminStatsRepository } from '@/repositories/AdminStatsRepository';
import { GuestDraftAttemptRepository } from '@/repositories/GuestDraftAttemptRepository';
import { integrationDatabaseUri } from '../../setup/integration-db';

/** RIN-1447: attempts on a guest draft follow the quiz it became, and count as claimedGuestDraft. */
describe('guest draft claim', () => {
  const runId = `draft-claim-${randomUUID()}`;
  const at = (iso: string) => new Date(iso);

  function attempt(quiz: Types.ObjectId, takenAt: Date, extra: Record<string, unknown> = {}) {
    return {
      _id: new Types.ObjectId(),
      _integrationRun: runId,
      quiz,
      quizSnapshot: { integrity: 'complete', title: 'Fake quiz', slug: 'guest', questions: [] },
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
      db.collection('questionprogresses').deleteMany({ _integrationRun: runId }),
    ]);
  }, 10_000);

  it('moves every attempt on the draft and returns only the unowned hashes', async () => {
    const db = mongoose.connection;
    const draftId = new Types.ObjectId();
    const quizId = new Types.ObjectId();
    const hash = hashGuestClaimToken(randomBytes(32).toString('base64url'));
    const guest = attempt(draftId, new Date(), { guestClaimTokenHash: hash });
    const ownerId = new Types.ObjectId();
    const owned = attempt(draftId, new Date(), { user: ownerId });
    // Review-queue progress the earlier attempt claim keyed by the draft's snapshot slug.
    const draftSlug = `guest-draft-${draftId.toHexString()}`;
    const progress = (userId: string, quizSlug: string) => ({
      _id: new Types.ObjectId(),
      _integrationRun: runId,
      userId,
      quizSlug,
      questionId: 'q0',
      nextReviewDate: new Date(),
    });
    const ownerProgress = progress(ownerId.toHexString(), draftSlug);
    const strangerProgress = progress(new Types.ObjectId().toHexString(), draftSlug);
    await db.collection('questionprogresses').insertMany([ownerProgress, strangerProgress]);
    const other = attempt(new Types.ObjectId(), new Date(), {
      guestClaimTokenHash: hashGuestClaimToken(randomBytes(32).toString('base64url')),
    });
    await db.collection('attempts').insertMany([guest, owned, other]);

    const repository = new GuestDraftAttemptRepository();
    await expect(
      repository.moveGuestDraftAttempts(
        draftId.toHexString(),
        {
          id: quizId.toHexString(),
          slug: `${runId}-quiz`,
        },
        new Types.ObjectId().toHexString(),
      ),
    ).resolves.toEqual([hash]);

    const moved = await db
      .collection('attempts')
      .find({ _id: { $in: [guest._id, owned._id] } })
      .toArray();
    for (const doc of moved) {
      expect(doc).toMatchObject({
        quiz: quizId,
        quizSnapshot: { slug: `${runId}-quiz`, title: 'Fake quiz' },
        fromGuestDraft: true,
      });
    }
    // The owner's progress follows the quiz; a user who owns no attempt here is not touched.
    await expect(
      db.collection('questionprogresses').findOne({ _id: ownerProgress._id }),
    ).resolves.toMatchObject({ quizSlug: `${runId}-quiz` });
    await expect(
      db.collection('questionprogresses').findOne({ _id: strangerProgress._id }),
    ).resolves.toMatchObject({ quizSlug: draftSlug });
    const untouched = await db.collection('attempts').findOne({ _id: other._id });
    expect(untouched?.['fromGuestDraft']).toBeUndefined();
    // A second run (retry, second tab) finds nothing left on the draft.
    await expect(
      repository.moveGuestDraftAttempts(
        draftId.toHexString(),
        {
          id: quizId.toHexString(),
          slug: `${runId}-quiz`,
        },
        ownerId.toHexString(),
      ),
    ).resolves.toEqual([]);
  });

  /** One UTC ISO week, Monday 2100-05-03 to 2100-05-10, far from other suites. */
  it('counts a claimed guest-draft attempt as claimedGuest and claimedGuestDraft', async () => {
    const db = mongoose.connection;
    const signupAt = at('2100-05-03T09:00:00.000Z');
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
    const fromDraft = new Types.ObjectId();
    const fromStarter = new Types.ObjectId();
    await db.collection('users').insertMany([learner(fromDraft), learner(fromStarter)]);
    const claimedAt = at('2100-05-03T09:05:00.000Z');
    const takenAt = at('2100-05-03T08:30:00.000Z');
    await db.collection('attempts').insertMany([
      attempt(new Types.ObjectId(), takenAt, {
        user: fromDraft,
        claimedAt,
        fromGuestDraft: true,
      }),
      attempt(new Types.ObjectId(), takenAt, { user: fromStarter, claimedAt }),
    ]);

    const aggregates = await new AdminStatsRepository().getActivationAggregates(
      at('2100-05-03T00:00:00.000Z'),
      at('2100-05-10T00:00:00.000Z'),
    );

    expect(aggregates.cohorts).toEqual([
      expect.objectContaining({
        signups: 2,
        activated: 2,
        activatedBy: { quiz: 2, adaptive: 0, both: 0, claimedGuest: 2, claimedGuestDraft: 1 },
      }),
    ]);
  });
});
