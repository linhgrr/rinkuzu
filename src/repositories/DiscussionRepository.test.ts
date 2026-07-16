import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { buildDiscussionListPipeline } from '@/repositories/pipelines/discussion-list.mjs';

const discussionModelMocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
  findOneAndUpdate: vi.fn(),
  populate: vi.fn(),
  lean: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models/Discussion', () => ({
  default: {
    aggregate: discussionModelMocks.aggregate,
    findOneAndUpdate: discussionModelMocks.findOneAndUpdate,
  },
}));

import { DiscussionRepository } from '@/repositories/DiscussionRepository';

const now = new Date('2026-07-03T10:00:00.000Z');
const quizId = '507f191e810c19729de860ea';

describe('DiscussionRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    discussionModelMocks.findOneAndUpdate.mockReturnValue({
      populate: discussionModelMocks.populate,
    });
    discussionModelMocks.populate.mockReturnValue({ lean: discussionModelMocks.lean });
    discussionModelMocks.aggregate.mockResolvedValue([]);
  });

  it('loads quiz discussions and comment authors in one aggregation', async () => {
    const repository = new DiscussionRepository();

    await expect(repository.findByQuiz(quizId)).resolves.toEqual([]);

    expect(discussionModelMocks.aggregate).toHaveBeenCalledWith(
      buildDiscussionListPipeline(new Types.ObjectId(quizId)),
    );
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
});
