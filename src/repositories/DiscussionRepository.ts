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
import { buildDiscussionListPipeline } from '@/repositories/pipelines/discussion-list.mjs';

export class DiscussionRepository implements IDiscussionRepository {
  async findByQuiz(quizId: string): Promise<DiscussionEntity[]> {
    await connectDB();
    const quizObjectId = new Types.ObjectId(quizId);
    const records = await Discussion.aggregate<DiscussionPersistenceRecord>(
      buildDiscussionListPipeline(quizObjectId),
    );
    return records.map(DiscussionPersistenceMapper.toEntity);
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
      .populate('comments.author', 'name displayName avatar')
      .lean<DiscussionPersistenceRecord>();
    return record ? DiscussionPersistenceMapper.toEntity(record) : null;
  }
}
