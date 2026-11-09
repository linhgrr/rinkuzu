import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';

import connectDB from '@/lib/mongoose';
import CreditLedgerModel from '@/models/CreditLedger';
import CreditWalletModel from '@/models/CreditWallet';
import PremiumQuizSubmissionModel from '@/models/PremiumQuizSubmission';
import QuizModel from '@/models/Quiz';
import { PremiumQuizRepository } from '@/repositories/PremiumQuizRepository';
import { integrationDatabaseUri } from '../../setup/integration-db';

/**
 * RIN-1346: an owner unticking Premium makes the quiz public and withdraws its
 * open submissions in one transaction; approve refuses a quiz that is no longer
 * private, and a withdrawn submission cannot be decided.
 */
describe('Premium withdrawal on untick', () => {
  const repository = new PremiumQuizRepository();
  const reviewerId = new Types.ObjectId().toHexString();
  const authorId = new Types.ObjectId();
  const quizIds: Types.ObjectId[] = [];

  async function seedQuiz(visibility: 'personal' | 'public' = 'personal'): Promise<Types.ObjectId> {
    const quizId = new Types.ObjectId();
    quizIds.push(quizId);
    await QuizModel.collection.insertOne({
      _id: quizId,
      title: 'Fake quiz',
      slug: `premium-withdraw-${randomUUID()}`,
      author: authorId,
      visibility,
      questions: [],
      createdAt: new Date(),
    });
    return quizId;
  }

  async function seedSubmission(
    quizId: Types.ObjectId,
    version: number,
    fields: Record<string, unknown> = {},
  ): Promise<Types.ObjectId> {
    const id = new Types.ObjectId();
    const snapshotHash = randomUUID();
    await PremiumQuizSubmissionModel.collection.insertOne({
      _id: id,
      sourceQuiz: quizId,
      author: authorId,
      version,
      status: 'pending',
      active: false,
      snapshot: { title: 'Fake quiz', slug: `premium-withdraw-${randomUUID()}`, questions: [] },
      snapshotHash,
      questionHashes: [],
      sourceType: 'manual',
      rightsAttested: true,
      reviewStatus: 'completed',
      reviewSnapshotHash: snapshotHash,
      duplicateReport: {
        exactDocumentRewarded: false,
        exactQuiz: false,
        sharedQuestionCount: 0,
        highestSimilarity: 0,
        matches: [],
      },
      awardedCredits: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...fields,
    });
    return id;
  }

  async function quizVisibility(quizId: Types.ObjectId): Promise<unknown> {
    return (await QuizModel.collection.findOne({ _id: quizId }))?.['visibility'];
  }

  async function submission(id: Types.ObjectId) {
    return PremiumQuizSubmissionModel.collection.findOne({ _id: id });
  }

  beforeAll(async () => {
    process.env['MONGODB_URI'] = integrationDatabaseUri();
    await connectDB();
    // Collections must exist before a transaction writes to them.
    await Promise.all([
      QuizModel.createCollection(),
      PremiumQuizSubmissionModel.createCollection(),
      CreditWalletModel.createCollection(),
      CreditLedgerModel.createCollection(),
    ]);
  }, 15_000);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 1) return;
    await Promise.all([
      QuizModel.collection.deleteMany({ _id: { $in: quizIds } }),
      PremiumQuizSubmissionModel.collection.deleteMany({ sourceQuiz: { $in: quizIds } }),
      CreditWalletModel.collection.deleteMany({ user: authorId }),
      CreditLedgerModel.collection.deleteMany({ user: authorId }),
    ]);
    await mongoose.disconnect();
  }, 15_000);

  it.each(['pending', 'changes_requested'])(
    'makes the quiz public and withdraws a %s submission',
    async (status) => {
      const quizId = await seedQuiz();
      const rejected = await seedSubmission(quizId, 1, { status: 'rejected' });
      const open = await seedSubmission(quizId, 2, { status, active: true });

      const result = await repository.makeQuizPublicAndWithdrawSubmissions(quizId.toHexString());

      expect(result).toEqual({ outcome: 'made_public', withdrawnSubmissions: 1 });
      expect(await quizVisibility(quizId)).toBe('public');
      expect(await submission(open)).toMatchObject({ status: 'withdrawn', active: false });
      expect(await submission(rejected)).toMatchObject({ status: 'rejected' });
    },
  );

  it('writes neither the quiz nor the withdrawal when the transaction aborts', async () => {
    const quizId = await seedQuiz();
    const open = await seedSubmission(quizId, 1);
    vi.spyOn(PremiumQuizSubmissionModel, 'updateMany').mockImplementationOnce(() => {
      throw new Error('forced abort after the quiz write');
    });

    await expect(
      repository.makeQuizPublicAndWithdrawSubmissions(quizId.toHexString()),
    ).rejects.toThrow('forced abort');

    expect(await quizVisibility(quizId)).toBe('personal');
    expect(await submission(open)).toMatchObject({ status: 'pending' });
  });

  it('refuses while an approved publication is on sale and writes nothing', async () => {
    const quizId = await seedQuiz();
    const published = await seedSubmission(quizId, 1, {
      status: 'approved',
      active: true,
      awardedCredits: 3,
    });
    const open = await seedSubmission(quizId, 2);

    const result = await repository.makeQuizPublicAndWithdrawSubmissions(quizId.toHexString());

    expect(result).toEqual({ outcome: 'premium_published' });
    expect(await quizVisibility(quizId)).toBe('personal');
    expect(await submission(published)).toMatchObject({ status: 'approved', active: true });
    expect(await submission(open)).toMatchObject({ status: 'pending' });
  });

  it('refuses to approve a submission whose quiz is public: no credits, no publication', async () => {
    const quizId = await seedQuiz('public');
    const open = await seedSubmission(quizId, 1);

    await expect(
      repository.decide({
        submissionId: open.toHexString(),
        reviewerId,
        decision: 'approve',
        credits: 3,
      }),
    ).rejects.toMatchObject({
      name: 'PremiumQuizError',
      code: 'invalid_state',
      message: 'The quiz is no longer private; it cannot be published',
    });

    expect(await submission(open)).toMatchObject({ status: 'pending', active: false });
    expect(await CreditWalletModel.collection.findOne({ user: authorId })).toBeNull();
    expect(await CreditLedgerModel.collection.countDocuments({ user: authorId })).toBe(0);
  });

  it('still approves a submission whose quiz is private', async () => {
    const quizId = await seedQuiz();
    const open = await seedSubmission(quizId, 1);

    const result = await repository.decide({
      submissionId: open.toHexString(),
      reviewerId,
      decision: 'approve',
      credits: 2,
    });

    expect(result.submission.status).toBe('approved');
    expect(result.awardedCredits).toBe(2);
  });

  it.each(['approve', 'reject', 'request_changes'] as const)(
    'refuses to %s a withdrawn submission',
    async (decision) => {
      const quizId = await seedQuiz();
      const withdrawn = await seedSubmission(quizId, 1, { status: 'withdrawn' });

      await expect(
        repository.decide({
          submissionId: withdrawn.toHexString(),
          reviewerId,
          decision,
          credits: 2,
        }),
      ).rejects.toMatchObject({ name: 'PremiumQuizError', code: 'invalid_state' });

      expect(await submission(withdrawn)).toMatchObject({ status: 'withdrawn' });
      expect(await quizVisibility(quizId)).toBe('personal');
    },
  );
});
