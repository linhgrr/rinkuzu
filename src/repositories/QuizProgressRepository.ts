import { Types } from 'mongoose';
import connectDB from '@/lib/mongoose';
import QuizProgressModel from '@/models/QuizProgress';
import {
  IQuizProgressRepository,
  QuizProgressUpsertData,
} from '@/interfaces/repositories/IQuizProgressRepository';
import type { QuizProgress } from '@/entities/QuizProgress';
import { AnswerPersistenceMapper } from '@/repositories/mappers/AnswerPersistenceMapper';
import { QuizProgressPersistenceMapper } from '@/repositories/mappers/QuizProgressPersistenceMapper';
import type { QuizProgressPersistenceRecord } from '@/repositories/types/QuizProgressPersistence';

export class QuizProgressRepository implements IQuizProgressRepository {
  async upsert(
    userId: string,
    quizId: string,
    data: QuizProgressUpsertData,
  ): Promise<QuizProgress> {
    await connectDB();
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(quizId)) {
      throw new Error('Invalid quiz progress identity');
    }
    const userObjectId = new Types.ObjectId(userId);
    const quizObjectId = new Types.ObjectId(quizId);
    const progress = await QuizProgressModel.findOneAndUpdate(
      { userId: userObjectId, quiz: quizObjectId },
      {
        $set: {
          ...data,
          userAnswers: data.userAnswers.map(AnswerPersistenceMapper.toPersistence),
          userId: userObjectId,
          quiz: quizObjectId,
          updatedAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean<QuizProgressPersistenceRecord>();

    if (!progress) {
      throw new Error('Failed to upsert quiz progress');
    }
    return QuizProgressPersistenceMapper.toEntity(progress);
  }

  async findByUserAndQuiz(userId: string, quizId: string): Promise<QuizProgress | null> {
    await connectDB();
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(quizId)) {
      return null;
    }
    const userObjectId = new Types.ObjectId(userId);
    const quizObjectId = new Types.ObjectId(quizId);
    const progress = await QuizProgressModel.findOne({
      userId: userObjectId,
      quiz: quizObjectId,
    }).lean<QuizProgressPersistenceRecord>();
    return progress ? QuizProgressPersistenceMapper.toEntity(progress) : null;
  }

  async deleteByUserAndQuiz(userId: string, quizId: string): Promise<boolean> {
    await connectDB();
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(quizId)) {
      return false;
    }
    const userObjectId = new Types.ObjectId(userId);
    const quizObjectId = new Types.ObjectId(quizId);
    const result = await QuizProgressModel.deleteOne({
      userId: userObjectId,
      quiz: quizObjectId,
    });
    return result.deletedCount > 0;
  }

  async findInProgressByUser(userId: string, limit: number): Promise<QuizProgress[]> {
    await connectDB();
    if (!Types.ObjectId.isValid(userId)) {
      return [];
    }
    const records = await QuizProgressModel.find({ userId: new Types.ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate({ path: 'quiz', select: 'title slug' })
      .lean<QuizProgressPersistenceRecord[]>();
    return records.map(QuizProgressPersistenceMapper.toEntity);
  }
}
