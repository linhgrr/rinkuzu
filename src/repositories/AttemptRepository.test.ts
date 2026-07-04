import { beforeEach, describe, expect, it, vi } from 'vitest';

const attemptMocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
  find: vi.fn(),
  select: vi.fn(),
  populate: vi.fn(),
  sort: vi.fn(),
  skip: vi.fn(),
  limit: vi.fn(),
  lean: vi.fn(),
  countDocuments: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models/Attempt', () => ({
  default: {
    aggregate: attemptMocks.aggregate,
    find: attemptMocks.find,
    countDocuments: attemptMocks.countDocuments,
  },
}));

import { AttemptRepository } from '@/repositories/AttemptRepository';

describe('AttemptRepository.findByUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    attemptMocks.find.mockReturnValue({ select: attemptMocks.select });
    attemptMocks.select.mockReturnValue({ populate: attemptMocks.populate });
    attemptMocks.populate.mockReturnValue({ sort: attemptMocks.sort });
    attemptMocks.sort.mockReturnValue({ skip: attemptMocks.skip });
    attemptMocks.skip.mockReturnValue({ limit: attemptMocks.limit });
    attemptMocks.limit.mockReturnValue({ lean: attemptMocks.lean });
    attemptMocks.lean.mockResolvedValue([]);
    attemptMocks.countDocuments.mockResolvedValue(0);
    attemptMocks.aggregate.mockResolvedValue([]);
  });

  it('projects attempt summaries without loading saved answers', async () => {
    const repository = new AttemptRepository();

    await expect(repository.findByUser('user-1', { page: 2, limit: 10 })).resolves.toMatchObject({
      items: [],
      pagination: {
        currentPage: 2,
        itemsPerPage: 10,
        totalItems: 0,
      },
    });

    expect(attemptMocks.find).toHaveBeenCalledWith({ user: 'user-1' });
    expect(attemptMocks.select).toHaveBeenCalledWith(
      'user guestEmail quiz score totalQuestions takenAt',
    );
    expect(attemptMocks.populate).toHaveBeenCalledWith('quiz', 'title slug description');
    expect(attemptMocks.sort).toHaveBeenCalledWith({ takenAt: -1 });
    expect(attemptMocks.skip).toHaveBeenCalledWith(10);
    expect(attemptMocks.limit).toHaveBeenCalledWith(10);
    expect(attemptMocks.countDocuments).toHaveBeenCalledWith({ user: 'user-1' });
  });

  it('loads attempt details and quiz questions in one aggregation', async () => {
    const repository = new AttemptRepository();
    const attemptId = '507f191e810c19729de860ea';
    const userId = '507f191e810c19729de860eb';

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
