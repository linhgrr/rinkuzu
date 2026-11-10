import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';

import connectDB from '@/lib/mongoose';
import GuestQuizDraftModel from '@/models/GuestQuizDraft';
import { GuestQuizDraftRepository } from '@/repositories/GuestQuizDraftRepository';
import { integrationDatabaseUri } from '../../setup/integration-db';

/** RIN-1446: guest drafts live in their own collection, expire by TTL, and the first poll wins. */
describe('guest quiz draft repository', () => {
  const repository = new GuestQuizDraftRepository();
  const tokenHash = 'a'.repeat(64);

  beforeAll(async () => {
    process.env['MONGODB_URI'] = integrationDatabaseUri();
    await connectDB();
    await GuestQuizDraftModel.syncIndexes();
  }, 20_000);

  const olderHash = 'b'.repeat(64);
  const newerHash = 'c'.repeat(64);

  afterAll(async () => {
    await GuestQuizDraftModel.deleteMany({ tokenHash: { $in: [tokenHash, olderHash, newerHash] } });
  }, 10_000);

  it('has a TTL index on expiresAt and a unique token hash', async () => {
    const indexes = await mongoose.connection.collection('guestquizdrafts').indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }),
        expect.objectContaining({ key: { tokenHash: 1 }, unique: true }),
      ]),
    );
  });

  it('stores a processing draft, moves it to ready once, then refuses a second transition', async () => {
    const created = await repository.create({
      tokenHash,
      apiDraftId: 'api-draft-test',
      locale: 'vi',
      entry: 'create',
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(created).toMatchObject({ status: 'processing', questionCount: 0 });

    const questions = [
      { question: 'Fake?', options: ['a', 'b'], type: 'single' as const, correctIndex: 0 },
    ];
    expect(await repository.markReady(created.id, { title: 'Fake quiz', questions })).toBe(true);
    expect(await repository.markReady(created.id, { title: 'Again', questions })).toBe(false);
    expect(await repository.markFailed(created.id, 'ocr_failed')).toBe(false);

    expect(await repository.findByTokenHash(tokenHash)).toMatchObject({
      status: 'ready',
      title: 'Fake quiz',
      questionCount: 1,
      failureReason: null,
    });
    expect(
      await mongoose.connection.collection('quizzes').countDocuments({ title: 'Fake quiz' }),
    ).toBe(0);
  }, 20_000);

  it('returns claimable drafts newest first, so the claim names the played one first (RIN-1485)', async () => {
    const questions = [
      { question: 'Fake?', options: ['a', 'b'], type: 'single' as const, correctIndex: 0 },
    ];
    for (const [hash, title] of [
      [olderHash, 'Older fake quiz'],
      [newerHash, 'Newer fake quiz'],
    ] as const) {
      const draft = await repository.create({
        tokenHash: hash,
        apiDraftId: `api-draft-${title}`,
        locale: 'en',
        entry: 'landing',
        expiresAt: new Date(Date.now() + 60_000),
      });
      await repository.markReady(draft.id, { title, questions });
    }

    const claimable = await repository.findClaimable([olderHash, newerHash], new Date());
    expect(claimable.map((draft) => draft.title)).toEqual(['Newer fake quiz', 'Older fake quiz']);
  }, 20_000);
});
