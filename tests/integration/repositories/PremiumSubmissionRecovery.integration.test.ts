import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';

import connectDB from '@/lib/mongoose';
import CreditLedgerModel from '@/models/CreditLedger';
import CreditWalletModel from '@/models/CreditWallet';
import PremiumQuizSubmissionModel from '@/models/PremiumQuizSubmission';
import QuizModel from '@/models/Quiz';
import { AdminActionAudit } from '@/models/Communication';
import { PremiumQuizRepository } from '@/repositories/PremiumQuizRepository';
import { integrationDatabaseUri } from '../../setup/integration-db';

/**
 * RIN-1347: after a Premium submission fails, the just-saved quiz goes back to
 * public unless an older submission (or an admin) still holds it private.
 */
describe('Premium failed-submission recovery', () => {
  const repository = new PremiumQuizRepository();
  const authorId = new Types.ObjectId();
  const quizIds: Types.ObjectId[] = [];

  async function seedQuiz(visibility: 'personal' | 'public' = 'personal'): Promise<Types.ObjectId> {
    const quizId = new Types.ObjectId();
    quizIds.push(quizId);
    await QuizModel.collection.insertOne({
      _id: quizId,
      title: 'Fake quiz',
      slug: `premium-recovery-${randomUUID()}`,
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
      snapshot: { title: 'Fake quiz', slug: `premium-recovery-${randomUUID()}`, questions: [] },
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
      AdminActionAudit.createCollection(),
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
      AdminActionAudit.collection.deleteMany({
        entityId: { $in: quizIds.map((id) => id.toHexString()) },
      }),
    ]);
    await mongoose.disconnect();
  }, 15_000);

  it('makes a private quiz with no live submission public', async () => {
    const quizId = await seedQuiz();
    await seedSubmission(quizId, 1, { status: 'rejected' });
    await seedSubmission(quizId, 2, { status: 'withdrawn' });

    await expect(repository.restorePublicAfterFailedSubmission(quizId.toHexString())).resolves.toBe(
      true,
    );
    expect(await quizVisibility(quizId)).toBe('public');
  });

  it.each([
    ['pending', false],
    ['changes_requested', false],
    ['approved', true],
  ])('keeps the quiz private while a %s submission is live', async (status, active) => {
    const quizId = await seedQuiz();
    const live = await seedSubmission(quizId, 1, { status, active });
    const before = await submission(live);

    await expect(repository.restorePublicAfterFailedSubmission(quizId.toHexString())).resolves.toBe(
      false,
    );
    expect(await quizVisibility(quizId)).toBe('personal');
    expect(await submission(live)).toEqual(before);
  });

  it('flips a quiz whose only approved submission is no longer active', async () => {
    const quizId = await seedQuiz();
    await seedSubmission(quizId, 1, { status: 'approved', active: false });

    await expect(repository.restorePublicAfterFailedSubmission(quizId.toHexString())).resolves.toBe(
      true,
    );
    expect(await quizVisibility(quizId)).toBe('public');
  });

  it('keeps a quiz an admin hid on purpose private', async () => {
    const quizId = await seedQuiz();
    await AdminActionAudit.collection.insertOne({
      entityType: 'quiz',
      entityId: quizId.toHexString(),
      action: 'quiz.visibility.changed',
      details: { from: 'public', to: 'personal' },
      createdAt: new Date(),
    });

    await expect(repository.restorePublicAfterFailedSubmission(quizId.toHexString())).resolves.toBe(
      false,
    );
    expect(await quizVisibility(quizId)).toBe('personal');
  });

  it('leaves an already public quiz alone', async () => {
    const quizId = await seedQuiz('public');

    await expect(repository.restorePublicAfterFailedSubmission(quizId.toHexString())).resolves.toBe(
      false,
    );
    expect(await quizVisibility(quizId)).toBe('public');
  });
});
