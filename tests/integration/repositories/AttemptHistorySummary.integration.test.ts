import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';

import connectDB from '@/lib/mongoose';
import { AttemptRepository } from '@/repositories/AttemptRepository';
import { integrationDatabaseUri } from '../../setup/integration-db';

/** RIN-1197: the history summary covers every attempt; the result filter narrows only the list. */
describe('attempt history summary and result filter', () => {
  const userId = new Types.ObjectId();
  const otherUserId = new Types.ObjectId();
  const scores = Array.from({ length: 25 }, (_, index) => (index * 7) % 101);
  const reads = new AttemptRepository();

  function attemptDoc(user: Types.ObjectId, score: number, index: number) {
    return {
      user,
      quiz: new Types.ObjectId(),
      quizSnapshot: {
        integrity: 'complete',
        title: `Fake quiz ${index}`,
        slug: `fake-history-${index}`,
        questions: [],
      },
      answers: [],
      score,
      totalQuestions: 10,
      correctAnswers: Math.round(score / 10),
      takenAt: new Date(Date.UTC(2100, 0, 1, 0, index)),
    };
  }

  beforeAll(async () => {
    process.env['MONGODB_URI'] = integrationDatabaseUri();
    await connectDB();
    await mongoose.connection
      .collection('attempts')
      .insertMany([
        ...scores.map((score, index) => attemptDoc(userId, score, index)),
        attemptDoc(otherUserId, 0, 99),
      ]);
  }, 15_000);

  afterAll(async () => {
    await mongoose.connection
      .collection('attempts')
      .deleteMany({ user: { $in: [userId, otherUserId] } });
  }, 10_000);

  it('returns the same all-attempts summary on every page and filter', async () => {
    const mean = Math.round((scores.reduce((sum, score) => sum + score, 0) / 25) * 10) / 10;
    const needsWork = scores.filter((score) => score < 60).length;
    const expected = { totalAttempts: 25, averageScore: mean, needsWorkCount: needsWork };

    const pages = await Promise.all([
      reads.findByUser(userId.toHexString(), { page: 1, limit: 10 }),
      reads.findByUser(userId.toHexString(), { page: 3, limit: 10 }),
      reads.findByUser(userId.toHexString(), { page: 1, limit: 5, result: 'needs_work' }),
      reads.findByUser(userId.toHexString(), { page: 2, limit: 10, result: 'passed' }),
    ]);

    for (const page of pages) expect(page.summary).toEqual(expected);
    const [first, third, needsWorkPage, passedPage] = pages;
    expect(first?.items).toHaveLength(10);
    expect(third?.items).toHaveLength(5);
    expect(needsWorkPage?.pagination.totalItems).toBe(needsWork);
    expect(needsWorkPage?.items.every((attempt) => attempt.score < 60)).toBe(true);
    expect(passedPage?.pagination.totalItems).toBe(25 - needsWork);
    expect(passedPage?.items.every((attempt) => attempt.score >= 60)).toBe(true);
  }, 20_000);

  it('reports a null average with no attempts', async () => {
    const empty = await reads.findByUser(new Types.ObjectId().toHexString(), {
      page: 1,
      limit: 10,
    });

    expect(empty.summary).toEqual({ totalAttempts: 0, averageScore: null, needsWorkCount: 0 });
    expect(empty.pagination.totalItems).toBe(0);
  });
});
