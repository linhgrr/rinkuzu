import connectDB from '@/lib/mongoose';
import Attempt from '@/models/Attempt';
import { buildPaginationMeta } from '@/repositories/pagination';
import { IAttempt, IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository';

export class AttemptRepository implements IAttemptRepository {
  async findById(id: string): Promise<IAttempt | null> {
    await connectDB();
    const attempt = await Attempt.findById(id)
      .populate({
        path: 'quiz',
        select: 'title slug description questions',
      })
      .lean();
    return attempt as unknown as IAttempt | null;
  }

  async findByUser(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
    },
  ): Promise<{
    attempts: IAttempt[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    await connectDB();

    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const skip = (page - 1) * limit;

    const attempts = (await Attempt.find({ user: userId })
      .populate({
        path: 'quiz',
        select: 'title slug description questions',
      })
      .sort({ takenAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()) as unknown as IAttempt[];

    const totalItems = await Attempt.countDocuments({ user: userId });

    return {
      attempts,
      pagination: buildPaginationMeta(page, limit, totalItems),
    };
  }

  async findByUserId(
    userId: string,
    page?: number,
    limit?: number,
  ): Promise<{ attempts: IAttempt[]; total: number }> {
    await connectDB();

    const pageNum = page || 1;
    const limitNum = limit || 10;
    const skip = (pageNum - 1) * limitNum;

    const attempts = (await Attempt.find({ user: userId })
      .populate({
        path: 'quiz',
        select: 'title slug description questions',
      })
      .sort({ takenAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()) as unknown as IAttempt[];

    const total = await Attempt.countDocuments({ user: userId });

    return { attempts, total };
  }

  async create(attemptData: Partial<IAttempt>): Promise<IAttempt> {
    await connectDB();
    const attempt = new Attempt(attemptData);
    const saved = await attempt.save();
    return saved.toObject();
  }

  async countByUser(userId: string): Promise<number> {
    await connectDB();
    return await Attempt.countDocuments({ user: userId });
  }

  async countByQuiz(quizId: string): Promise<number> {
    await connectDB();
    return await Attempt.countDocuments({ quiz: quizId });
  }

  async findRecentActivity(limit: number = 10): Promise<IAttempt[]> {
    await connectDB();
    return (await Attempt.find()
      .populate('quiz', 'title slug')
      .sort({ takenAt: -1 })
      .limit(limit)
      .lean()) as unknown as IAttempt[];
  }

  async findByIdWithQuiz(attemptId: string, userId: string): Promise<any> {
    await connectDB();
    return await Attempt.findOne({
      _id: attemptId,
      user: userId,
    })
      .populate({
        path: 'quiz',
        select: 'title slug description questions',
      })
      .lean();
  }

  async update(id: string, attemptData: Partial<IAttempt>): Promise<IAttempt | null> {
    await connectDB();
    const updated = await Attempt.findByIdAndUpdate(id, attemptData, { new: true }).lean();
    return updated as unknown as IAttempt | null;
  }

  async delete(id: string): Promise<boolean> {
    await connectDB();
    const result = await Attempt.findByIdAndDelete(id);
    return !!result;
  }

  async count(filter: any = {}): Promise<number> {
    await connectDB();
    return await Attempt.countDocuments(filter);
  }
}
