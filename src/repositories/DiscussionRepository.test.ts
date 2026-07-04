import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import type { Discussion } from '@/entities/Discussion';

const discussionModelMocks = vi.hoisted(() => ({
  bulkWrite: vi.fn(),
  find: vi.fn(),
  findPopulate: vi.fn(),
  findOneAndUpdate: vi.fn(),
  populate: vi.fn(),
  sort: vi.fn(),
  lean: vi.fn(),
  findLean: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models/Discussion', () => ({
  default: {
    bulkWrite: discussionModelMocks.bulkWrite,
    find: discussionModelMocks.find,
    findOneAndUpdate: discussionModelMocks.findOneAndUpdate,
  },
}));

import { DiscussionRepository } from '@/repositories/DiscussionRepository';

const now = new Date('2026-07-03T10:00:00.000Z');
const quizId = '507f191e810c19729de860ea';

function discussion(questionIndex: number): Discussion {
  return {
    id: `discussion-${questionIndex}`,
    quiz: quizId,
    questionIndex,
    comments: [],
    createdAt: now,
    updatedAt: now,
  };
}

describe('DiscussionRepository.ensureForQuizQuestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    discussionModelMocks.bulkWrite.mockResolvedValue(undefined);
    discussionModelMocks.findOneAndUpdate.mockReturnValue({
      populate: discussionModelMocks.populate,
    });
    discussionModelMocks.populate.mockReturnValue({ lean: discussionModelMocks.lean });
    discussionModelMocks.find.mockReturnValue({ populate: discussionModelMocks.findPopulate });
    discussionModelMocks.findPopulate.mockReturnValue({ sort: discussionModelMocks.sort });
    discussionModelMocks.sort.mockReturnValue({ lean: discussionModelMocks.findLean });
    discussionModelMocks.findLean.mockResolvedValue([]);
  });

  it('does not write when all quiz question discussions already exist', async () => {
    const repository = new DiscussionRepository();
    vi.spyOn(repository, 'findByQuiz').mockResolvedValue([discussion(0), discussion(1)]);

    const result = await repository.ensureForQuizQuestions(quizId, 2);

    expect(result.map((item) => item.questionIndex)).toEqual([0, 1]);
    expect(discussionModelMocks.bulkWrite).not.toHaveBeenCalled();
  });

  it('atomically creates the discussion and adds its first comment', async () => {
    const discussionId = new Types.ObjectId('507f191e810c19729de860eb');
    const authorId = new Types.ObjectId('507f191e810c19729de860ec');
    discussionModelMocks.lean.mockResolvedValue({
      _id: discussionId,
      quiz: new Types.ObjectId(quizId),
      questionIndex: 2,
      comments: [
        {
          _id: new Types.ObjectId('507f191e810c19729de860ed'),
          author: {
            _id: authorId,
            email: 'learner@example.com',
          },
          content: 'Needs explanation',
          isEdited: false,
          createdAt: now,
          updatedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    });
    const repository = new DiscussionRepository();

    await expect(
      repository.addCommentForQuizQuestion(quizId, 2, {
        authorId: authorId.toString(),
        content: 'Needs explanation',
      }),
    ).resolves.toMatchObject({
      id: discussionId.toString(),
      questionIndex: 2,
      comments: [
        {
          author: {
            id: authorId.toString(),
            email: 'learner@example.com',
          },
          content: 'Needs explanation',
        },
      ],
    });
    expect(discussionModelMocks.findOneAndUpdate).toHaveBeenCalledWith(
      {
        quiz: new Types.ObjectId(quizId),
        questionIndex: 2,
      },
      {
        $setOnInsert: {
          quiz: new Types.ObjectId(quizId),
          questionIndex: 2,
        },
        $push: {
          comments: {
            _id: expect.any(Types.ObjectId),
            author: authorId,
            content: 'Needs explanation',
            isEdited: false,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
    expect(discussionModelMocks.populate).toHaveBeenCalledWith(
      'comments.author',
      'email name displayName avatar',
    );
    expect(discussionModelMocks.lean).toHaveBeenCalledOnce();
  });

  it('upserts missing discussion indexes and fetches only those rows', async () => {
    const repository = new DiscussionRepository();
    const findByQuiz = vi.spyOn(repository, 'findByQuiz').mockResolvedValueOnce([discussion(0)]);
    discussionModelMocks.findLean.mockResolvedValueOnce([
      {
        _id: new Types.ObjectId('507f191e810c19729de860e1'),
        quiz: new Types.ObjectId(quizId),
        questionIndex: 1,
        comments: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: new Types.ObjectId('507f191e810c19729de860e2'),
        quiz: new Types.ObjectId(quizId),
        questionIndex: 2,
        comments: [],
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const result = await repository.ensureForQuizQuestions(quizId, 3);

    expect(result.map((item) => item.questionIndex)).toEqual([0, 1, 2]);
    expect(findByQuiz).toHaveBeenCalledOnce();
    expect(discussionModelMocks.bulkWrite).toHaveBeenCalledTimes(1);
    expect(discussionModelMocks.bulkWrite).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: expect.objectContaining({ questionIndex: 1 }),
          }),
        }),
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: expect.objectContaining({ questionIndex: 2 }),
          }),
        }),
      ],
      { ordered: false },
    );
    expect(discussionModelMocks.find).toHaveBeenCalledWith({
      quiz: new Types.ObjectId(quizId),
      questionIndex: { $in: [1, 2] },
    });
    expect(discussionModelMocks.findPopulate).toHaveBeenCalledWith(
      'comments.author',
      'email name displayName avatar',
    );
  });
});
