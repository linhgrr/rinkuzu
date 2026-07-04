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
});
