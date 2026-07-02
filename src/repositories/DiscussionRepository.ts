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
    const records = await Discussion.find({ quiz: quizId })
      .populate('comments.author', 'email name displayName avatar')
      .sort({ questionIndex: 1, createdAt: 1 })
      .lean<DiscussionPersistenceRecord[]>();
    return records.map(DiscussionPersistenceMapper.toEntity);
  }

  async ensureForQuizQuestions(quizId: string, questionCount: number): Promise<DiscussionEntity[]> {
    await connectDB();
    const existingRecords = await Discussion.find({ quiz: quizId })
      .select('questionIndex')
      .lean<Array<{ questionIndex: number }>>();
    const existingIndexes = new Set(existingRecords.map((record) => record.questionIndex));
    const missingDiscussions = Array.from({ length: questionCount }, (_, questionIndex) =>
      existingIndexes.has(questionIndex)
        ? null
        : {
            quiz: new Types.ObjectId(quizId),
            questionIndex,
          },
    ).filter((discussion): discussion is { quiz: Types.ObjectId; questionIndex: number } =>
      Boolean(discussion),
    );

    if (missingDiscussions.length > 0) {
      await Discussion.insertMany(missingDiscussions, { ordered: false });
    }

    const discussions = await this.findByQuiz(quizId);
    const discussionByIndex = new Map(
      discussions.map((discussion) => [discussion.questionIndex, discussion]),
    );

    return Array.from({ length: questionCount }, (_, questionIndex) => {
      const discussion = discussionByIndex.get(questionIndex);
      if (!discussion) {
        throw new Error(`Missing discussion for question index ${questionIndex}`);
      }
      return discussion;
    });
  }

  async ensureForQuizQuestion(quizId: string, questionIndex: number): Promise<DiscussionEntity> {
    await connectDB();
    const record = await Discussion.findOneAndUpdate(
      {
        quiz: new Types.ObjectId(quizId),
        questionIndex,
      },
      {
        $setOnInsert: {
          quiz: new Types.ObjectId(quizId),
          questionIndex,
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

    if (!record) {
      throw new Error(`Discussion could not be resolved for question index ${questionIndex}`);
    }
    return DiscussionPersistenceMapper.toEntity(record);
  }

  async addComment(
    discussionId: string,
    data: CreateDiscussionCommentData,
  ): Promise<DiscussionEntity | null> {
    await connectDB();
    const now = new Date();
    const record = await Discussion.findByIdAndUpdate(
      discussionId,
      {
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
      { new: true, runValidators: true },
    )
      .populate('comments.author', 'email name displayName avatar')
      .lean<DiscussionPersistenceRecord>();
    return record ? DiscussionPersistenceMapper.toEntity(record) : null;
  }
}
