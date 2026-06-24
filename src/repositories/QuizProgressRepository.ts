import { Types } from 'mongoose';
import connectDB from '@/lib/mongoose';
import QuizProgress, { IQuizProgress as IQuizProgressDoc } from '@/models/QuizProgress';
import { BaseRepository } from '@/repositories/base';
import {
  IQuizProgress,
  IQuizProgressRepository,
  QuizProgressUpsertData,
} from '@/interfaces/repositories/IQuizProgressRepository';

export class QuizProgressRepository
  extends BaseRepository<IQuizProgressDoc>
  implements IQuizProgressRepository
{
  constructor() {
    super(QuizProgress);
  }

  async upsert(
    userId: string,
    quizId: string,
    data: QuizProgressUpsertData,
  ): Promise<IQuizProgress> {
    await connectDB();
    const progress = await QuizProgress.findOneAndUpdate(
      { userId, quiz: new Types.ObjectId(quizId) },
      {
        $set: {
          ...data,
          userId,
          quiz: new Types.ObjectId(quizId),
          updatedAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();

    return progress as unknown as IQuizProgress;
  }

  async findByUserAndQuiz(userId: string, quizId: string): Promise<IQuizProgress | null> {
    await connectDB();
    if (!Types.ObjectId.isValid(quizId)) {
      return null;
    }
    const progress = await QuizProgress.findOne({
      userId,
      quiz: new Types.ObjectId(quizId),
    }).lean();
    return (progress as unknown as IQuizProgress | null) ?? null;
  }

  async deleteByUserAndQuiz(userId: string, quizId: string): Promise<boolean> {
    await connectDB();
    if (!Types.ObjectId.isValid(quizId)) {
      return false;
    }
    const result = await QuizProgress.deleteOne({
      userId,
      quiz: new Types.ObjectId(quizId),
    });
    return result.deletedCount > 0;
  }

  async findInProgressByUser(userId: string, limit: number = 8): Promise<IQuizProgress[]> {
    await connectDB();
    const records = await QuizProgress.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate({
        path: 'quiz',
        select: 'title slug category',
        populate: { path: 'category', select: 'name color' },
      })
      .lean();
    return records as unknown as IQuizProgress[];
  }
}
