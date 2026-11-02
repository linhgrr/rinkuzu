import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';

import { buildPaginatedCreatorStatsPipeline } from '@/repositories/pipelines/creator-stats.mjs';
import { integrationDatabaseUri } from '../../setup/integration-db';

interface CreatorStatsResult {
  items: Array<{ _id: Types.ObjectId; email?: string; quizCount: number }>;
  meta: Array<{ totalItems: number }>;
}

/**
 * RIN-634: a quiz whose author no longer exists must not reach the repository
 * as an unresolved creator, and must not count towards `totalItems`.
 *
 * The pipeline runs on a per-run quizzes collection so the counts are exact on
 * a shared integration database; its `$lookup` reads the real `users`
 * collection, where the fixture users are tagged and removed afterwards.
 */
describe('creator stats pipeline (orphaned quizzes)', () => {
  const runId = `creator-stats-${randomUUID()}`;
  const quizzesName = `rin634_quizzes_${runId.replace(/-/g, '_')}`;
  const alice = new Types.ObjectId();
  const bob = new Types.ObjectId();
  const carol = new Types.ObjectId();
  const deleted = new Types.ObjectId();

  const quiz = (author: Types.ObjectId, questions: number) => ({
    author,
    questions: Array.from({ length: questions }, (_, index) => ({ question: `q${index}` })),
  });

  const run = async (page: number, limit: number): Promise<CreatorStatsResult> => {
    const [result] = await mongoose.connection
      .collection(quizzesName)
      .aggregate<CreatorStatsResult>(buildPaginatedCreatorStatsPipeline({ page, limit }))
      .toArray();
    return result;
  };

  beforeAll(async () => {
    await mongoose.connect(integrationDatabaseUri(), { serverSelectionTimeoutMS: 2_000 });
    const db = mongoose.connection;
    const joinedAt = new Date('2001-02-01T00:00:00.000Z');
    await db.collection('users').insertMany(
      [alice, bob, carol].map((_id, index) => ({
        _id,
        email: `creator-${index}-${runId}@example.test`,
        role: 'user',
        createdAt: joinedAt,
        _integrationRun: runId,
      })),
    );
    // The deleted author has the most quizzes, so before the fix it sorted
    // first and filled page 1 with an unresolved row.
    await db
      .collection(quizzesName)
      .insertMany([
        quiz(deleted, 5),
        quiz(deleted, 5),
        quiz(deleted, 5),
        quiz(deleted, 5),
        quiz(alice, 3),
        quiz(alice, 3),
        quiz(alice, 3),
        quiz(bob, 2),
        quiz(bob, 2),
        quiz(carol, 1),
      ]);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 1) return;
    const db = mongoose.connection;
    await db.collection('users').deleteMany({ _integrationRun: runId });
    await db.dropCollection(quizzesName).catch(() => undefined);
    await mongoose.disconnect();
  }, 10_000);

  it('excludes the orphaned creator from items and totalItems', async () => {
    const result = await run(1, 10);

    expect(result.items.map((item) => item.quizCount)).toEqual([3, 2, 1]);
    expect(result.items.map((item) => String(item._id))).toEqual([alice, bob, carol].map(String));
    expect(result.items.every((item) => typeof item.email === 'string')).toBe(true);
    expect(result.meta).toEqual([{ totalItems: 3 }]);
  });

  it('keeps pages full and consistent with totalItems', async () => {
    const first = await run(1, 2);
    const second = await run(2, 2);

    expect(first.items.map((item) => String(item._id))).toEqual([alice, bob].map(String));
    expect(second.items.map((item) => String(item._id))).toEqual([String(carol)]);
    expect(first.meta).toEqual([{ totalItems: 3 }]);
    expect(second.meta).toEqual([{ totalItems: 3 }]);
  });
});
