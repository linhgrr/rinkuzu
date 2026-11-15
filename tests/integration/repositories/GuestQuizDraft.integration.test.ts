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
  const legacyHash = 'd'.repeat(64);

  afterAll(async () => {
    await GuestQuizDraftModel.deleteMany({
      tokenHash: { $in: [tokenHash, olderHash, newerHash, legacyHash] },
    });
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
      source: 'pdf',
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
    for (const [hash, title, source] of [
      [olderHash, 'Older fake quiz', 'pdf'],
      [newerHash, 'Newer fake quiz', 'text'],
    ] as const) {
      const draft = await repository.create({
        tokenHash: hash,
        apiDraftId: `api-draft-${title}`,
        locale: 'en',
        entry: 'landing',
        source,
        expiresAt: new Date(Date.now() + 60_000),
      });
      await repository.markReady(draft.id, { title, questions });
    }

    const claimable = await repository.findClaimable([olderHash, newerHash], new Date());
    expect(claimable.map((draft) => draft.title)).toEqual(['Newer fake quiz', 'Older fake quiz']);
    // A pasted-text draft keeps its source to the claimed event (RIN-1538).
    expect(claimable.map((draft) => draft.source)).toEqual(['text', 'pdf']);
  }, 20_000);

  it('reads a draft stored before RIN-1538, with no source field, as a PDF draft', async () => {
    await mongoose.connection.collection('guestquizdrafts').insertOne({
      tokenHash: legacyHash,
      apiDraftId: 'api-draft-legacy',
      status: 'processing',
      questions: [],
      locale: 'en',
      entry: 'landing',
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(await repository.findByTokenHash(legacyHash)).toMatchObject({ source: 'pdf' });
  }, 20_000);
});

/** RIN-1619: a first batch is playable; two polls completing it append the rest once. */
describe('guest quiz draft first batch', () => {
  const repository = new GuestQuizDraftRepository();
  const partialHash = 'e'.repeat(64);
  const legacyReadyHash = 'f'.repeat(64);
  const fake = (n: number) => ({
    question: `Fake ${n}?`,
    options: ['a', 'b'],
    type: 'single' as const,
    correctIndex: 0,
  });

  beforeAll(async () => {
    process.env['MONGODB_URI'] = integrationDatabaseUri();
    await connectDB();
  }, 20_000);

  afterAll(async () => {
    await GuestQuizDraftModel.deleteMany({ tokenHash: { $in: [partialHash, legacyReadyHash] } });
  }, 10_000);

  it('appends the rest exactly once, in order, when two polls complete it together', async () => {
    const created = await repository.create({
      tokenHash: partialHash,
      apiDraftId: 'api-draft-partial',
      locale: 'en',
      entry: 'landing',
      source: 'text',
      expiresAt: new Date(Date.now() + 60_000),
    });
    const firstBatch = [fake(1), fake(2)];
    expect(
      await repository.storeFirstBatch(created.id, { title: 'Quiz', questions: firstBatch }),
    ).toBe(true);
    expect(await repository.storeFirstBatch(created.id, { title: 'Quiz', questions: [] })).toBe(
      false,
    );
    expect(await repository.findByTokenHash(partialHash)).toMatchObject({
      status: 'ready',
      questionCount: 2,
      complete: false,
      completion: null,
    });
    expect(await repository.findReadyByTokenHash(partialHash)).toMatchObject({
      complete: false,
      completion: null,
    });
    expect(await repository.findClaimable([partialHash], new Date())).toEqual([
      expect.objectContaining({ complete: false }),
    ]);

    const update = {
      storedCount: 2,
      questions: [fake(3), fake(4)],
      title: 'Fake topic',
      completion: 'full' as const,
    };
    const results = await Promise.all([
      repository.completeDraft(created.id, update),
      repository.completeDraft(created.id, update),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    const ready = await repository.findReadyByTokenHash(partialHash);
    expect(ready?.questions.map((question) => question.question)).toEqual([
      'Fake 1?',
      'Fake 2?',
      'Fake 3?',
      'Fake 4?',
    ]);
    expect(ready).toMatchObject({ title: 'Fake topic', complete: true, completion: 'full' });
  }, 20_000);

  it('reads a ready draft stored before RIN-1619 (no complete field) as complete', async () => {
    await mongoose.connection.collection('guestquizdrafts').insertOne({
      tokenHash: legacyReadyHash,
      apiDraftId: 'api-draft-legacy-ready',
      status: 'ready',
      title: 'Legacy fake quiz',
      questions: [fake(1)],
      locale: 'en',
      entry: 'landing',
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(await repository.findByTokenHash(legacyReadyHash)).toMatchObject({
      complete: true,
      completion: 'full',
    });
    const id = (await repository.findByTokenHash(legacyReadyHash))?.id ?? '';
    expect(
      await repository.completeDraft(id, { storedCount: 1, questions: [], completion: 'full' }),
    ).toBe(false);
  }, 20_000);
});
