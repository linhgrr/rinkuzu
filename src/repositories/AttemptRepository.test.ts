import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const attemptMocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
  populate: vi.fn(),
  distinct: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models/Attempt', () => ({
  default: {
    aggregate: attemptMocks.aggregate,
    distinct: attemptMocks.distinct,
  },
}));

import { AttemptRepository } from '@/repositories/AttemptRepository';
import { ZodError } from 'zod';

describe('AttemptRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    attemptMocks.aggregate.mockResolvedValue([{ items: [], meta: [] }]);
  });

  describe('findByUser', () => {
    it('loads attempt summaries and total count in one aggregation', async () => {
      const repository = new AttemptRepository();
      const userId = '507f191e810c19729de860ea';

      await expect(repository.findByUser(userId, { page: 2, limit: 10 })).resolves.toMatchObject({
        items: [],
        pagination: {
          currentPage: 2,
          itemsPerPage: 10,
          totalItems: 0,
        },
      });

      const [pipeline] = attemptMocks.aggregate.mock.calls[0] ?? [];
      expect(pipeline?.[0]).toEqual({ $match: { user: new Types.ObjectId(userId) } });
      expect(pipeline?.[1]).toEqual({ $sort: { takenAt: -1 } });
      const facet = pipeline?.[2]?.$facet;
      expect(facet?.meta).toEqual([{ $count: 'totalItems' }]);
      expect(facet?.items).toEqual([
        { $skip: 10 },
        { $limit: 10 },
        {
          $project: expect.objectContaining({
            answers: { $literal: [] },
            quiz: expect.objectContaining({
              title: '$quizSnapshot.title',
              slug: '$quizSnapshot.slug',
            }),
          }),
        },
      ]);
      expect(attemptMocks.populate).not.toHaveBeenCalledWith('quiz', 'title slug description');
    });

    it('rejects invalid user ids without querying Mongo', async () => {
      const repository = new AttemptRepository();

      await expect(
        repository.findByUser('not-an-object-id', { page: 1, limit: 10 }),
      ).rejects.toThrow(ZodError);
      expect(attemptMocks.aggregate).not.toHaveBeenCalled();
    });

    it('treats an empty aggregate facet result as zero items and zero total', async () => {
      // Pins result?.items ?? [] and result?.meta optional chaining when facet is missing.
      attemptMocks.aggregate.mockResolvedValueOnce([]);
      const repository = new AttemptRepository();
      const userId = '507f191e810c19729de860ea';

      await expect(repository.findByUser(userId, { page: 1, limit: 10 })).resolves.toEqual({
        items: [],
        pagination: {
          currentPage: 1,
          itemsPerPage: 10,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    });
  });

  describe('findByIdWithQuiz', () => {
    it('loads attempt details and quiz questions in one aggregation', async () => {
      const repository = new AttemptRepository();
      const attemptId = '507f191e810c19729de860ea';
      const userId = '507f191e810c19729de860eb';
      attemptMocks.aggregate.mockResolvedValueOnce([]);

      await expect(repository.findByIdWithQuiz(attemptId, { userId })).resolves.toBeNull();

      const [pipeline] = attemptMocks.aggregate.mock.calls[0] ?? [];
      expect(pipeline?.[0]).toEqual({
        $match: {
          _id: new Types.ObjectId(attemptId),
          user: new Types.ObjectId(userId),
        },
      });
      expect(pipeline?.[1]).toEqual({ $limit: 1 });
      expect(pipeline?.[2]?.$project).toEqual(
        expect.objectContaining({
          answers: 1,
          premiumSubmission: 1,
          premiumSnapshotHash: 1,
          quiz: expect.objectContaining({
            title: '$quizSnapshot.title',
            questions: '$quizSnapshot.questions',
          }),
        }),
      );
      expect(attemptMocks.populate).not.toHaveBeenCalledWith(
        'quiz',
        'title slug description questions',
      );
    });

    it('preserves guestEmail owner path with strict attempt ObjectId', async () => {
      const repository = new AttemptRepository();
      const attemptId = '507f191e810c19729de860ea';
      attemptMocks.aggregate.mockResolvedValueOnce([]);

      await expect(
        repository.findByIdWithQuiz(attemptId, { guestEmail: 'guest@example.com' }),
      ).resolves.toBeNull();

      const [pipeline] = attemptMocks.aggregate.mock.calls[0] ?? [];
      expect(pipeline?.[0]).toEqual({
        $match: {
          _id: new Types.ObjectId(attemptId),
          guestEmail: 'guest@example.com',
        },
      });
    });

    it('scopes a claim-token owner to unclaimed attempts and never projects the hash', async () => {
      const repository = new AttemptRepository();
      const attemptId = '507f191e810c19729de860ea';
      attemptMocks.aggregate.mockResolvedValueOnce([]);

      await expect(
        repository.findByIdWithQuiz(attemptId, { guestClaimTokenHash: 'd'.repeat(64) }),
      ).resolves.toBeNull();

      const [pipeline] = attemptMocks.aggregate.mock.calls[0] ?? [];
      expect(pipeline?.[0]).toEqual({
        $match: {
          _id: new Types.ObjectId(attemptId),
          guestClaimTokenHash: 'd'.repeat(64),
          user: null,
        },
      });
      expect(JSON.stringify(pipeline?.slice(1))).not.toContain('guestClaimTokenHash');
    });

    it('rejects invalid attempt ids without querying Mongo', async () => {
      const repository = new AttemptRepository();

      await expect(
        repository.findByIdWithQuiz('bad-id', { userId: '507f191e810c19729de860eb' }),
      ).rejects.toThrow(ZodError);
      expect(attemptMocks.aggregate).not.toHaveBeenCalled();
    });

    it('rejects invalid owner user ids without querying Mongo', async () => {
      const repository = new AttemptRepository();

      await expect(
        repository.findByIdWithQuiz('507f191e810c19729de860ea', { userId: 'not-valid' }),
      ).rejects.toThrow(ZodError);
      expect(attemptMocks.aggregate).not.toHaveBeenCalled();
    });
  });

  describe('findAttemptedQuizSlugs', () => {
    it('scopes a claim-token owner to its unclaimed attempts', async () => {
      const repository = new AttemptRepository();
      attemptMocks.distinct.mockResolvedValueOnce(['algebra']);

      await expect(
        repository.findAttemptedQuizSlugs({ guestClaimTokenHash: 'd'.repeat(64) }, ['algebra']),
      ).resolves.toEqual(['algebra']);

      expect(attemptMocks.distinct).toHaveBeenCalledWith('quizSnapshot.slug', {
        guestClaimTokenHash: 'd'.repeat(64),
        user: null,
        'quizSnapshot.slug': { $in: ['algebra'] },
      });
    });
  });

  describe('findRecentActivity', () => {
    it('loads recent activity and its previews in one bounded aggregation', async () => {
      const repository = new AttemptRepository();
      attemptMocks.aggregate.mockResolvedValueOnce([
        {
          _id: 'attempt-1',
          userEmail: 'learner@example.com',
          quizTitle: 'Algebra',
          score: 80,
          answeredQuestions: 2,
          takenAt: new Date('2026-06-28T00:00:00.000Z'),
        },
      ]);

      await expect(repository.findRecentActivity(5)).resolves.toEqual([
        {
          id: 'attempt-1',
          userEmail: 'learner@example.com',
          quizTitle: 'Algebra',
          score: 80,
          answeredQuestions: 2,
          takenAt: new Date('2026-06-28T00:00:00.000Z'),
        },
      ]);

      expect(attemptMocks.aggregate).toHaveBeenCalledWith([
        { $sort: { takenAt: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            pipeline: [{ $project: { _id: 0, email: 1 } }],
            as: 'userDoc',
          },
        },
        {
          $set: {
            userDoc: { $first: '$userDoc' },
          },
        },
        {
          $project: expect.objectContaining({
            userEmail: '$userDoc.email',
            quizTitle: '$quizSnapshot.title',
            answeredQuestions: expect.objectContaining({
              $size: expect.objectContaining({
                $filter: expect.objectContaining({
                  input: '$answers',
                }),
              }),
            }),
          }),
        },
      ]);

      const pipeline = attemptMocks.aggregate.mock.calls[0]?.[0];
      const projection = pipeline?.at(-1)?.$project;
      expect(projection).not.toHaveProperty('answers');
      expect(projection).not.toHaveProperty('totalQuestions');
    });

    it('omits optional identity/title fields only when undefined and keeps score fields', async () => {
      // Pins conditional spreads for userEmail/guestEmail/quizTitle and serializeId field name.
      const repository = new AttemptRepository();
      attemptMocks.aggregate.mockResolvedValueOnce([
        {
          _id: 'attempt-guest',
          guestEmail: 'guest@example.com',
          score: 40,
          answeredQuestions: 1,
          takenAt: new Date('2026-06-27T00:00:00.000Z'),
        },
        {
          _id: 'attempt-user',
          userEmail: 'user@example.com',
          quizTitle: 'Geometry',
          score: 90,
          answeredQuestions: 5,
          takenAt: new Date('2026-06-26T00:00:00.000Z'),
        },
      ]);

      await expect(repository.findRecentActivity(2)).resolves.toEqual([
        {
          id: 'attempt-guest',
          guestEmail: 'guest@example.com',
          score: 40,
          answeredQuestions: 1,
          takenAt: new Date('2026-06-27T00:00:00.000Z'),
        },
        {
          id: 'attempt-user',
          userEmail: 'user@example.com',
          quizTitle: 'Geometry',
          score: 90,
          answeredQuestions: 5,
          takenAt: new Date('2026-06-26T00:00:00.000Z'),
        },
      ]);
    });

    it('rejects activity rows with missing ids via serializeId', async () => {
      const repository = new AttemptRepository();
      attemptMocks.aggregate.mockResolvedValueOnce([
        {
          score: 10,
          answeredQuestions: 0,
          takenAt: new Date('2026-06-25T00:00:00.000Z'),
        },
      ]);

      await expect(repository.findRecentActivity(1)).rejects.toThrow(
        /recentAttempt\._id is required/,
      );
    });
  });

  describe('scoreStats', () => {
    it('returns zeros when no attempts exist', async () => {
      attemptMocks.aggregate.mockResolvedValueOnce([]);
      const repository = new AttemptRepository();

      await expect(repository.scoreStats()).resolves.toEqual({
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
      });
    });

    it('returns aggregated score stats when records exist', async () => {
      attemptMocks.aggregate.mockResolvedValueOnce([
        { averageScore: 72.5, highestScore: 100, lowestScore: 20 },
      ]);
      const repository = new AttemptRepository();

      await expect(repository.scoreStats()).resolves.toEqual({
        averageScore: 72.5,
        highestScore: 100,
        lowestScore: 20,
      });

      const [pipeline] = attemptMocks.aggregate.mock.calls[0] ?? [];
      expect(pipeline?.[0]).toEqual({
        $group: {
          _id: null,
          averageScore: { $avg: '$score' },
          highestScore: { $max: '$score' },
          lowestScore: { $min: '$score' },
        },
      });
    });
  });
});
