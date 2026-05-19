import connectDB from '@/lib/mongoose';
import Quiz from '@/models/Quiz';
import { IQuiz, IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import { buildPaginationMeta } from '@/repositories/pagination';
import { BaseRepository } from '@/repositories/base';
import { Types, type FilterQuery, type UpdateQuery } from 'mongoose';

type QuizSort = Record<string, 1 | -1>;

export class QuizRepository extends BaseRepository<IQuiz> implements IQuizRepository {
  constructor() {
    super(Quiz);
  }

  override async findById(id: string): Promise<IQuiz | null> {
    await connectDB();
    return (await Quiz.findById(id)
      .populate('author', 'email name displayName avatar')
      .populate('category', 'name color')
      .lean()) as unknown as IQuiz | null;
  }

  async findBySlug(slug: string): Promise<IQuiz | null> {
    await connectDB();
    return (await Quiz.findOne({ slug })
      .populate('author', 'email name displayName avatar')
      .populate('category', 'name color')
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
      .populate('category', 'name color')
      .lean()) as unknown as IQuiz | null;
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
        typeof normalizedFilter.category === 'string' &&
        Types.ObjectId.isValid(normalizedFilter.category)
      ) {
        normalizedFilter.category = new Types.ObjectId(normalizedFilter.category);
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
              from: 'categories',
              localField: 'category',
              foreignField: '_id',
              as: 'categoryDoc',
            },
          },
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
              path: '$categoryDoc',
              preserveNullAndEmptyArrays: true,
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
              category: {
                _id: { $ifNull: ['$categoryDoc._id', '$category'] },
                name: '$categoryDoc.name',
                color: '$categoryDoc.color',
              },
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
    if (options.populate?.includes('category')) {
      query = query.populate('category', 'name color');
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
        .populate('category', 'name color')
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

  async countByCategory(): Promise<{ _id: string; count: number }[]> {
    await connectDB();
    return await Quiz.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryInfo',
        },
      },
    ]);
  }

  async findRecentQuizzes(limit: number = 10): Promise<IQuiz[]> {
    await connectDB();
    return (await Quiz.find({ status: 'published' })
      .populate('author', 'email name displayName avatar')
      .populate('category', 'name color')
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
