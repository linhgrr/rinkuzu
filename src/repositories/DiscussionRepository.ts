import connectDB from '@/lib/mongoose';
import Discussion from '@/models/Discussion';
import type { Discussion as DiscussionEntity } from '@/entities/Discussion';
import {
  IDiscussionRepository,
  type CreateDiscussionCommentData,
} from '@/interfaces/repositories/IDiscussionRepository';
import { Types } from 'mongoose';
import { DiscussionPersistenceMapper } from '@/repositories/mappers/DiscussionPersistenceMapper';
import type { DiscussionPersistenceRecord } from '@/repositories/types/DiscussionPersistence';

const discussionAuthorProjection = {
  _id: '$$author._id',
  email: '$$author.email',
  name: '$$author.name',
  displayName: '$$author.displayName',
  avatar: '$$author.avatar',
};

export class DiscussionRepository implements IDiscussionRepository {
  async findById(id: string): Promise<DiscussionEntity | null> {
    await connectDB();
    const record = await Discussion.findById(id)
      .populate('comments.author', 'email name displayName avatar')
      .lean<DiscussionPersistenceRecord>();
    return record ? DiscussionPersistenceMapper.toEntity(record) : null;
  }

  async findByQuiz(quizId: string): Promise<DiscussionEntity[]> {
    await connectDB();
    const quizObjectId = new Types.ObjectId(quizId);
    const records = await Discussion.aggregate<DiscussionPersistenceRecord>([
      { $match: { quiz: quizObjectId } },
      { $sort: { questionIndex: 1, createdAt: 1 } },
      {
        $lookup: {
          from: 'users',
          localField: 'comments.author',
          foreignField: '_id',
          as: 'authorDocs',
        },
      },
      {
        $project: {
          quiz: 1,
          questionIndex: 1,
          createdAt: 1,
          updatedAt: 1,
          comments: {
            $map: {
              input: '$comments',
              as: 'comment',
              in: {
                _id: '$$comment._id',
                content: '$$comment.content',
                isEdited: '$$comment.isEdited',
                createdAt: '$$comment.createdAt',
                updatedAt: '$$comment.updatedAt',
                author: {
                  $let: {
                    vars: {
                      author: {
                        $first: {
                          $filter: {
                            input: '$authorDocs',
                            as: 'author',
                            cond: { $eq: ['$$author._id', '$$comment.author'] },
                          },
                        },
                      },
                    },
                    in: discussionAuthorProjection,
                  },
                },
              },
            },
          },
        },
      },
    ]);
    return records.map(DiscussionPersistenceMapper.toEntity);
  }

  async ensureForQuizQuestions(quizId: string, questionCount: number): Promise<DiscussionEntity[]> {
    await connectDB();
    const quizObjectId = new Types.ObjectId(quizId);
    const existingDiscussions = await this.findByQuiz(quizId);
    const discussionByIndex = new Map(
      existingDiscussions.map((discussion) => [discussion.questionIndex, discussion]),
    );
    const missingQuestionIndexes = Array.from({ length: questionCount }, (_, questionIndex) =>
      discussionByIndex.has(questionIndex) ? null : questionIndex,
    ).filter((questionIndex): questionIndex is number => questionIndex !== null);

    if (missingQuestionIndexes.length > 0) {
      await Discussion.bulkWrite(
        missingQuestionIndexes.map((questionIndex) => ({
          updateOne: {
            filter: {
              quiz: quizObjectId,
              questionIndex,
            },
            update: {
              $setOnInsert: {
                quiz: quizObjectId,
                questionIndex,
              },
            },
            upsert: true,
          },
        })),
        { ordered: false },
      );
    }

    const resolvedDiscussionByIndex = new Map(discussionByIndex);

    if (missingQuestionIndexes.length > 0) {
      const insertedRecords = await Discussion.find({
        quiz: quizObjectId,
        questionIndex: { $in: missingQuestionIndexes },
      })
        .populate('comments.author', 'email name displayName avatar')
        .sort({ questionIndex: 1, createdAt: 1 })
        .lean<DiscussionPersistenceRecord[]>();

      for (const discussion of insertedRecords.map(DiscussionPersistenceMapper.toEntity)) {
        resolvedDiscussionByIndex.set(discussion.questionIndex, discussion);
      }
    }

    return Array.from({ length: questionCount }, (_, questionIndex) => {
      const discussion = resolvedDiscussionByIndex.get(questionIndex);
      if (!discussion) {
        throw new Error(`Missing discussion for question index ${questionIndex}`);
      }
      return discussion;
    });
  }

  async addCommentForQuizQuestion(
    quizId: string,
    questionIndex: number,
    data: CreateDiscussionCommentData,
  ): Promise<DiscussionEntity | null> {
    await connectDB();
    const quizObjectId = new Types.ObjectId(quizId);
    const now = new Date();
    const record = await Discussion.findOneAndUpdate(
      {
        quiz: quizObjectId,
        questionIndex,
      },
      {
        $setOnInsert: {
          quiz: quizObjectId,
          questionIndex,
        },
        $push: {
          comments: {
            _id: new Types.ObjectId(),
            author: new Types.ObjectId(data.authorId),
            content: data.content,
            isEdited: false,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    )
      .populate('comments.author', 'email name displayName avatar')
      .lean<DiscussionPersistenceRecord>();
    return record ? DiscussionPersistenceMapper.toEntity(record) : null;
  }
}
