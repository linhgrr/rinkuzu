import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';

import connectDB from '@/lib/mongoose';
import { LearningProgressRepository } from '@/repositories/LearningProgressRepository';
import { integrationDatabaseUri } from '../../setup/integration-db';

/**
 * RIN-1198: the My Quizzes library filters by status and title on the server,
 * pages the filtered list, and reports whole-library counts that ignore both.
 *
 * Every document belongs to a fresh user id, so the per-user pipeline sees only
 * this run's fixtures on a shared integration database.
 */
describe('library status/search filters and counts', () => {
  const runId = `library-${randomUUID()}`;
  const user = new Types.ObjectId();
  const userId = user.toHexString();
  const repository = new LearningProgressRepository();
  const base = new Date('2100-01-01T00:00:00.000Z').getTime();

  // 130 owned quizzes: 5 in progress, 25 complete, 100 not started.
  const quizIds = Array.from({ length: 130 }, () => new Types.ObjectId());
  const title = (index: number): string => {
    if (index === 0) return '100% Kanji (N5)';
    if (index === 1) return 'Kanji drill';
    if (index === 2) return '100x speed';
    return `Fixture quiz ${index}`;
  };

  beforeAll(async () => {
    process.env['MONGODB_URI'] = integrationDatabaseUri();
    await connectDB();
    const db = mongoose.connection;
    await db.collection('quizzes').insertMany(
      quizIds.map((_id, index) => ({
        _id,
        _integrationRun: runId,
        author: user,
        title: title(index),
        slug: `${runId}-${index}`,
        visibility: 'personal',
        questions: [],
        createdAt: new Date(base + index * 1000),
        updatedAt: new Date(base + index * 1000),
      })),
    );
    await db.collection('quizprogresses').insertMany(
      quizIds.slice(0, 5).map((quiz, index) => ({
        _integrationRun: runId,
        userId: user,
        quiz,
        updatedAt: new Date(base + 10_000_000 + index),
      })),
    );
    // Quiz 0 also has an attempt: progress still wins, so it stays in progress.
    await db.collection('attempts').insertMany(
      [0, ...Array.from({ length: 25 }, (_, index) => index + 5)].map((index) => ({
        _integrationRun: runId,
        user,
        quiz: quizIds[index],
        takenAt: new Date(base + 5_000_000 + index),
      })),
    );
  }, 15_000);

  afterAll(async () => {
    const db = mongoose.connection;
    await Promise.all(
      ['quizzes', 'quizprogresses', 'attempts'].map((name) =>
        db.collection(name).deleteMany({ _integrationRun: runId }),
      ),
    );
  });

  const wholeLibrary = { all: 130, inProgress: 5, complete: 25 };

  it('reaches all 130 quizzes in pages of 24 with counts that add up', async () => {
    const seen = new Set<string>();
    for (let page = 1; page <= 6; page += 1) {
      const result = await repository.listLibraryQuizzes(userId, { page, limit: 24 });
      expect(result.counts).toEqual(wholeLibrary);
      expect(result.pagination).toMatchObject({ totalItems: 130, totalPages: 6 });
      for (const quiz of result.items) seen.add(quiz.id);
    }
    expect(seen.size).toBe(130);
  });

  it('pages a status-filtered list and keeps whole-library counts', async () => {
    const first = await repository.listLibraryQuizzes(userId, {
      page: 1,
      limit: 24,
      status: 'complete',
    });
    const second = await repository.listLibraryQuizzes(userId, {
      page: 2,
      limit: 24,
      status: 'complete',
    });

    expect(first.counts).toEqual(wholeLibrary);
    expect(first.pagination).toMatchObject({ totalItems: 25, totalPages: 2, hasNextPage: true });
    expect(first.items).toHaveLength(24);
    expect(second.items).toHaveLength(1);
    expect([...first.items, ...second.items].every((q) => q.libraryStatus === 'complete')).toBe(
      true,
    );

    const inProgress = await repository.listLibraryQuizzes(userId, {
      page: 1,
      limit: 24,
      status: 'in_progress',
    });
    expect(inProgress.items.map((q) => q.libraryStatus)).toEqual(Array(5).fill('in_progress'));
  });

  it('matches title fragments case-insensitively and regex characters literally', async () => {
    const kanji = await repository.listLibraryQuizzes(userId, { page: 1, limit: 24, q: 'kANJI' });
    expect(kanji.items.map((q) => q.title).sort()).toEqual(['100% Kanji (N5)', 'Kanji drill']);
    expect(kanji.counts).toEqual(wholeLibrary);

    const percent = await repository.listLibraryQuizzes(userId, { page: 1, limit: 24, q: '%' });
    expect(percent.items.map((q) => q.title)).toEqual(['100% Kanji (N5)']);

    const parens = await repository.listLibraryQuizzes(userId, { page: 1, limit: 24, q: '(N5)' });
    expect(parens.items.map((q) => q.title)).toEqual(['100% Kanji (N5)']);

    const dot = await repository.listLibraryQuizzes(userId, { page: 1, limit: 24, q: '100.' });
    expect(dot.pagination.totalItems).toBe(0);

    const drill = await repository.listLibraryQuizzes(userId, {
      page: 1,
      limit: 24,
      q: 'drill',
      status: 'in_progress',
    });
    expect(drill.items.map((q) => q.title)).toEqual(['Kanji drill']);
    expect(drill.counts).toEqual(wholeLibrary);

    // Quiz 0 has an attempt too, but progress wins: it is not "complete".
    const progressWins = await repository.listLibraryQuizzes(userId, {
      page: 1,
      limit: 24,
      q: '(N5)',
      status: 'complete',
    });
    expect(progressWins.pagination.totalItems).toBe(0);
  });
});
