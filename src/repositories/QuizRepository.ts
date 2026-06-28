import connectDB from '@/lib/mongoose';
import Quiz from '@/models/Quiz';
import Attempt from '@/models/Attempt';
import Bookmark from '@/models/Bookmark';
import Discussion from '@/models/Discussion';
import QuestionProgress from '@/models/QuestionProgress';
import Report from '@/models/Report';
import FolderQuiz from '@/models/FolderQuiz';
import QuizProgress from '@/models/QuizProgress';
import { IQuiz, IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import { buildPaginationMeta } from '@/repositories/pagination';
import { BaseRepository } from '@/repositories/base';
import mongoose, { Types, type FilterQuery, type UpdateQuery } from 'mongoose';

type QuizSort = Record<string, 1 | -1>;

export class QuizRepository extends BaseRepository<IQuiz> implements IQuizRepository {
  constructor() {
    super(Quiz);
  }

  override async findById(id: string): Promise<IQuiz | null> {
    await connectDB();
    return (await Quiz.findById(id)
      .populate('author', 'email name displayName avatar')
      .lean()) as unknown as IQuiz | null;
  }

  async findBySlug(slug: string): Promise<IQuiz | null> {
    await connectDB();
    return (await Quiz.findOne({ slug })
      .populate('author', 'email name displayName avatar')
      .lean()) as unknown as IQuiz | null;
  }

  async findBySlugAndStatus(slug: string, status: string): Promise<IQuiz | null> {
    await connectDB();
    return (await Quiz.findOne({ slug, status })
      .populate('author', 'email name displayName avatar')
      .lean()) as unknown as IQuiz | null;
  }

  override async update(id: string, quizData: Partial<IQuiz>): Promise<IQuiz | null> {
    await connectDB();
    return (await Quiz.findByIdAndUpdate(id, quizData, { new: true })
      .populate('author', 'email name displayName avatar')
      .lean()) as unknown as IQuiz | null;
  }

  override async delete(id: string): Promise<boolean> {
    await connectDB();
    const session = await mongoose.startSession();
    let deleted = false;

    try {
      await session.withTransaction(async () => {
        const quiz = await Quiz.findById(id)
          .select('_id slug')
          .session(session)
          .lean<{ _id: Types.ObjectId; slug: string } | null>();
        if (!quiz) return;

        await Promise.all([
          Attempt.deleteMany({ quiz: quiz._id }).session(session),
          Discussion.deleteMany({ quiz: quiz._id }).session(session),
          Report.deleteMany({ quizId: String(quiz._id) }).session(session),
          Bookmark.deleteMany({ 'quiz.slug': quiz.slug }).session(session),
          QuestionProgress.deleteMany({ quizSlug: quiz.slug }).session(session),
          FolderQuiz.deleteMany({ quiz: quiz._id }).session(session),
          QuizProgress.deleteMany({ quiz: quiz._id }).session(session),
        ]);

        const result = await Quiz.deleteOne({ _id: quiz._id }).session(session);
        deleted = result.deletedCount === 1;
      });

      return deleted;
    } finally {
      await session.endSession();
    }
  }

  async findAll(
    filter: FilterQuery<IQuiz> = {},
    options: {
      page?: number;
      limit?: number;
      sort?: QuizSort;
      populate?: string[];
      compact?: boolean;
    } = {},
  ): Promise<{
    quizzes: IQuiz[];
    pagination: import('@/types').PaginationMeta;
  }> {
    await connectDB();

    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;
    const sort: QuizSort = options.sort || { createdAt: -1 };

    if (options.compact) {
      const normalizedFilter: FilterQuery<IQuiz> = { ...filter };

      if (
        typeof normalizedFilter.folder === 'string' &&
        Types.ObjectId.isValid(normalizedFilter.folder)
      ) {
        normalizedFilter.folder = new Types.ObjectId(normalizedFilter.folder);
      }
      if (
        typeof normalizedFilter.author === 'string' &&
        Types.ObjectId.isValid(normalizedFilter.author)
      ) {
        normalizedFilter.author = new Types.ObjectId(normalizedFilter.author);
      }

      const [quizzes, total] = await Promise.all([
        Quiz.aggregate([
          { $match: normalizedFilter },
          { $sort: sort },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'users',
              localField: 'author',
              foreignField: '_id',
              as: 'authorDoc',
            },
          },
          {
            $unwind: {
              path: '$authorDoc',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              _id: 1,
              title: 1,
              description: 1,
              slug: 1,
              status: 1,
              isPrivate: 1,
              author: {
                _id: { $ifNull: ['$authorDoc._id', '$author'] },
                email: '$authorDoc.email',
                name: '$authorDoc.name',
                displayName: '$authorDoc.displayName',
                avatar: '$authorDoc.avatar',
              },
              createdAt: 1,
              updatedAt: 1,
              folder: 1,
              questionCount: { $size: { $ifNull: ['$questions', []] } },
              questions: { $literal: [] },
            },
          },
        ]) as unknown as IQuiz[],
        Quiz.countDocuments(normalizedFilter),
      ]);

      return {
        quizzes,
        pagination: buildPaginationMeta(page, limit, total),
      };
    }

    let query = Quiz.find(filter);

    if (options.populate?.includes('author')) {
      query = query.populate('author', 'email name displayName avatar');
    }
    const [quizzes, total] = await Promise.all([
      query.sort(sort).skip(skip).limit(limit).lean() as unknown as IQuiz[],
      Quiz.countDocuments(filter),
    ]);

    return {
      quizzes,
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async findForPlay(slug: string): Promise<IQuiz | null> {
    await connectDB();
    return (await Quiz.findOne({
      slug,
      status: 'published',
    })
      .populate('author', 'email name displayName avatar')
      .lean()) as unknown as IQuiz | null;
  }

  async findUserQuizzes(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      status?: string;
    } = {},
  ): Promise<{
    quizzes: IQuiz[];
    pagination: import('@/types').PaginationMeta;
  }> {
    await connectDB();

    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<IQuiz> = { author: userId };
    if (options.status) {
      filter.status = options.status;
    }

    const [quizzes, total] = await Promise.all([
      Quiz.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean() as unknown as IQuiz[],
      Quiz.countDocuments(filter),
    ]);

    return {
      quizzes,
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async countByStatus(): Promise<{ _id: string; count: number }[]> {
    await connectDB();
    return await Quiz.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);
  }

  async findRecentQuizzes(limit: number = 10): Promise<IQuiz[]> {
    await connectDB();
    return (await Quiz.find({ status: 'published' })
      .populate('author', 'email name displayName avatar')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()) as unknown as IQuiz[];
  }

  async updateStatus(id: string, status: string, reviewNote?: string): Promise<IQuiz | null> {
    await connectDB();
    const updateData: UpdateQuery<IQuiz> = { status };
    if (reviewNote) {
      updateData['reviewNote'] = reviewNote;
    }
    return (await Quiz.findByIdAndUpdate(id, updateData, {
      new: true,
    }).lean()) as unknown as IQuiz | null;
  }
}
