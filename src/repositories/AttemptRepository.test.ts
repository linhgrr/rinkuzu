import { beforeEach, describe, expect, it, vi } from 'vitest';

const attemptMocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
  populate: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models/Attempt', () => ({
  default: {
    aggregate: attemptMocks.aggregate,
  },
}));

import { AttemptRepository } from '@/repositories/AttemptRepository';

describe('AttemptRepository.findByUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    attemptMocks.aggregate.mockResolvedValue([{ items: [], meta: [] }]);
  });

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

    expect(attemptMocks.aggregate).toHaveBeenCalledWith([
      { $match: { user: expect.any(Object) } },
      { $sort: { takenAt: -1 } },
      {
        $facet: {
          items: [
            { $skip: 10 },
            { $limit: 10 },
            {
              $lookup: {
                from: 'quizzes',
                localField: 'quiz',
                foreignField: '_id',
                as: 'quizDoc',
              },
            },
            {
              $project: expect.objectContaining({
                answers: { $literal: [] },
                quiz: expect.objectContaining({
                  $let: expect.objectContaining({
                    in: expect.objectContaining({
                      title: '$$quiz.title',
                      slug: '$$quiz.slug',
                      description: '$$quiz.description',
                    }),
                  }),
                }),
              }),
            },
          ],
          meta: [{ $count: 'totalItems' }],
        },
      },
    ]);
    expect(attemptMocks.populate).not.toHaveBeenCalledWith('quiz', 'title slug description');
  });

  it('loads attempt details and quiz questions in one aggregation', async () => {
    const repository = new AttemptRepository();
    const attemptId = '507f191e810c19729de860ea';
    const userId = '507f191e810c19729de860eb';
    attemptMocks.aggregate.mockResolvedValueOnce([]);

    await expect(repository.findByIdWithQuiz(attemptId, { userId })).resolves.toBeNull();

    expect(attemptMocks.aggregate).toHaveBeenCalledWith([
      {
        $match: {
          _id: expect.any(Object),
          user: expect.any(Object),
        },
      },
      { $limit: 1 },
      {
        $lookup: {
          from: 'quizzes',
          localField: 'quiz',
          foreignField: '_id',
          as: 'quizDoc',
        },
      },
      {
        $project: expect.objectContaining({
          answers: 1,
          quiz: expect.objectContaining({
            $let: expect.objectContaining({
              in: expect.objectContaining({
                title: '$$quiz.title',
                questions: '$$quiz.questions',
              }),
            }),
          }),
        }),
      },
    ]);
    expect(attemptMocks.populate).not.toHaveBeenCalledWith(
      'quiz',
      'title slug description questions',
    );
  });

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
        $lookup: {
          from: 'quizzes',
          localField: 'quiz',
          foreignField: '_id',
          pipeline: [{ $project: { _id: 0, title: 1 } }],
          as: 'quizDoc',
        },
      },
      {
        $set: {
          userDoc: { $first: '$userDoc' },
          quizDoc: { $first: '$quizDoc' },
        },
      },
      {
        $project: expect.objectContaining({
          userEmail: '$userDoc.email',
          quizTitle: '$quizDoc.title',
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
});
