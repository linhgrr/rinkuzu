import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';

import connectDB from '@/lib/mongoose';
import { AdminActionAudit } from '@/models/Communication';
import PremiumQuizSubmissionModel from '@/models/PremiumQuizSubmission';
import QuizModel from '@/models/Quiz';
import { PremiumQuizPersistenceMapper } from '@/repositories/mappers/PremiumQuizPersistenceMapper';
import { PremiumQuizRepository } from '@/repositories/PremiumQuizRepository';
import { integrationDatabaseUri } from '../../setup/integration-db';

/**
 * RIN-1337: rejecting a Premium submission makes its quiz public, in the same
 * transaction as the decision, unless an admin hid the quiz, an earlier version
 * is still published, or a newer submission is waiting for review.
 */
describe('Premium reject quiz visibility', () => {
  const repository = new PremiumQuizRepository();
  const reviewerId = new Types.ObjectId().toHexString();
  const authorId = new Types.ObjectId();
  const quizIds: Types.ObjectId[] = [];

  async function seedQuiz(): Promise<Types.ObjectId> {
    const quizId = new Types.ObjectId();
    quizIds.push(quizId);
    await QuizModel.collection.insertOne({
      _id: quizId,
      title: 'Fake quiz',
      slug: `premium-reject-${randomUUID()}`,
      author: authorId,
      visibility: 'personal',
      questions: [],
      createdAt: new Date(),
    });
    return quizId;
  }

  async function seedSubmission(
    quizId: Types.ObjectId,
    version: number,
    fields: Record<string, unknown> = {},
  ): Promise<string> {
    const id = new Types.ObjectId();
    await PremiumQuizSubmissionModel.collection.insertOne({
      _id: id,
      sourceQuiz: quizId,
      author: authorId,
      version,
      status: 'pending',
      active: false,
      snapshot: { title: 'Fake quiz', slug: `premium-reject-${randomUUID()}`, questions: [] },
      snapshotHash: randomUUID(),
      questionHashes: [],
      sourceType: 'manual',
      rightsAttested: true,
      reviewStatus: 'not_started',
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
    return id.toHexString();
  }

  async function seedVisibilityChange(quizId: Types.ObjectId, to: string, at: Date) {
    await AdminActionAudit.collection.insertOne({
      actorId: new Types.ObjectId(reviewerId),
      actorEmail: 'admin@example.test',
      action: 'quiz.visibility.changed',
      entityType: 'quiz',
      entityId: quizId.toHexString(),
      details: { slug: 'fake', from: to === 'public' ? 'personal' : 'public', to },
      expiresAt: new Date(Date.now() + 86_400_000),
      createdAt: at,
    });
  }

  async function visibilityOf(quizId: Types.ObjectId): Promise<string | undefined> {
    const quiz = await QuizModel.collection.findOne({ _id: quizId });
    return quiz?.['visibility'] as string | undefined;
  }

  function decide(submissionId: string, decision: 'reject' | 'request_changes') {
    return repository.decide({ submissionId, reviewerId, decision, credits: 1 });
  }

  beforeAll(async () => {
    process.env['MONGODB_URI'] = integrationDatabaseUri();
    await connectDB();
    // Collections must exist before a transaction writes to them.
    await Promise.all([
      QuizModel.createCollection(),
      PremiumQuizSubmissionModel.createCollection(),
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
      AdminActionAudit.collection.deleteMany({
        entityId: { $in: quizIds.map((id) => id.toHexString()) },
      }),
    ]);
    await mongoose.disconnect();
  }, 15_000);

  it('makes a personal quiz public when its latest submission is rejected', async () => {
    const quizId = await seedQuiz();
    const submissionId = await seedSubmission(quizId, 1);

    const result = await decide(submissionId, 'reject');

    expect(result.submission.status).toBe('rejected');
    expect(result.quizMadePublic).toBe(true);
    expect(await visibilityOf(quizId)).toBe('public');
  });

  it('writes neither the rejection nor the visibility when the transaction aborts', async () => {
    const quizId = await seedQuiz();
    const submissionId = await seedSubmission(quizId, 1);
    vi.spyOn(PremiumQuizPersistenceMapper, 'toSubmission').mockImplementation(() => {
      throw new Error('forced abort after the writes');
    });

    await expect(decide(submissionId, 'reject')).rejects.toThrow('forced abort');

    const stored = await PremiumQuizSubmissionModel.collection.findOne({
      _id: new Types.ObjectId(submissionId),
    });
    expect(stored?.['status']).toBe('pending');
    expect(await visibilityOf(quizId)).toBe('personal');
  });

  it('leaves the quiz personal on request_changes', async () => {
    const quizId = await seedQuiz();
    const submissionId = await seedSubmission(quizId, 1);

    const result = await decide(submissionId, 'request_changes');

    expect(result.submission.status).toBe('changes_requested');
    expect(result.quizMadePublic).toBe(false);
    expect(await visibilityOf(quizId)).toBe('personal');
  });

  it('leaves an admin-hidden quiz personal', async () => {
    const quizId = await seedQuiz();
    await seedVisibilityChange(quizId, 'public', new Date('2026-11-01T00:00:00Z'));
    await seedVisibilityChange(quizId, 'personal', new Date('2026-11-02T00:00:00Z'));
    const submissionId = await seedSubmission(quizId, 1);

    const result = await decide(submissionId, 'reject');

    expect(result.submission.status).toBe('rejected');
    expect(result.quizMadePublic).toBe(false);
    expect(await visibilityOf(quizId)).toBe('personal');
  });

  it('makes the quiz public when the latest admin change un-hid it', async () => {
    const quizId = await seedQuiz();
    await seedVisibilityChange(quizId, 'personal', new Date('2026-11-01T00:00:00Z'));
    await seedVisibilityChange(quizId, 'public', new Date('2026-11-02T00:00:00Z'));
    const submissionId = await seedSubmission(quizId, 1);

    await decide(submissionId, 'reject');

    expect(await visibilityOf(quizId)).toBe('public');
  });

  it('leaves the quiz personal while an earlier version is published in Premium', async () => {
    const quizId = await seedQuiz();
    await seedSubmission(quizId, 1, { status: 'approved', active: true, awardedCredits: 3 });
    const submissionId = await seedSubmission(quizId, 2);

    const result = await decide(submissionId, 'reject');

    expect(result.submission.status).toBe('rejected');
    expect(result.quizMadePublic).toBe(false);
    expect(await visibilityOf(quizId)).toBe('personal');
  });

  it('leaves the quiz personal when a newer submission exists', async () => {
    const quizId = await seedQuiz();
    const older = await seedSubmission(quizId, 1);
    await seedSubmission(quizId, 2);

    const result = await decide(older, 'reject');

    expect(result.submission.status).toBe('rejected');
    expect(result.quizMadePublic).toBe(false);
    expect(await visibilityOf(quizId)).toBe('personal');
  });
});
