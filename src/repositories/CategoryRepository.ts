import connectDB from '@/lib/mongoose';
import Category from '@/models/Category';
import { buildPaginationMeta } from '@/repositories/pagination';
import { BaseRepository } from '@/repositories/base';
import { ICategory, ICategoryRepository } from '@/interfaces/repositories/ICategoryRepository';
import type { FilterQuery } from 'mongoose';

function normalizeSlug(value: string): string {
  return decodeURIComponent(value)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export class CategoryRepository extends BaseRepository<ICategory> implements ICategoryRepository {
  constructor() {
    super(Category);
  }

  async findBySlug(slug: string): Promise<ICategory | null> {
    await connectDB();

    const inputSlug = normalizeSlug(slug);
    const bySlug = (await Category.findOne(
      { slug: inputSlug, isActive: true },
      '_id name slug description color isActive createdBy createdAt updatedAt',
    ).lean()) as unknown as ICategory | null;

    if (bySlug) {
      return bySlug;
    }

    // Legacy fallback for records created before slug field existed.
    const legacyCategories = (await Category.find(
      { isActive: true },
      '_id name slug description color isActive createdBy createdAt updatedAt',
    ).lean()) as unknown as ICategory[];

    const legacyCategory =
      legacyCategories.find((cat) => normalizeSlug(cat.name) === inputSlug) ?? null;

    if (legacyCategory?._id && !legacyCategory.slug) {
      // Opportunistic backfill so subsequent reads hit indexed slug query.
      void Category.updateOne({ _id: legacyCategory._id }, { $set: { slug: inputSlug } }).exec();
    }

    return legacyCategory;
  }

  async findAll(
    options: {
      page?: number;
      limit?: number;
      search?: string;
      isActive?: boolean;
    } = {},
  ): Promise<{
    categories: ICategory[];
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

    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;

    const query: FilterQuery<ICategory> = {};
    if (options.search) {
      query.name = { $regex: options.search, $options: 'i' };
    }
    if (typeof options.isActive === 'boolean') {
      query.isActive = options.isActive;
    }

    const categories = (await Category.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean()) as unknown as ICategory[];

    const totalItems = await Category.countDocuments(query);

    return {
      categories,
      pagination: buildPaginationMeta(page, limit, totalItems),
    };
  }

  async findActive(): Promise<ICategory[]> {
    await connectDB();
    return (await Category.find({ isActive: true })
      .sort({ name: 1 })
      .lean()) as unknown as ICategory[];
  }

  async search(query: string): Promise<ICategory[]> {
    await connectDB();
    return (await Category.find({
      name: { $regex: query, $options: 'i' },
      isActive: true,
    })
      .sort({ name: 1 })
      .lean()) as unknown as ICategory[];
  }

  async findWithQuizCount(): Promise<{ category: ICategory; quizCount: number }[]> {
    await connectDB();
    const result = await Category.aggregate([
      {
        $lookup: {
          from: 'quizzes',
          localField: '_id',
          foreignField: 'category',
          as: 'quizzes',
        },
      },
      {
        $project: {
          name: 1,
          slug: 1,
          description: 1,
          color: 1,
          isActive: 1,
          createdBy: 1,
          createdAt: 1,
          updatedAt: 1,
          quizCount: { $size: '$quizzes' },
        },
      },
      {
        $sort: { name: 1 },
      },
    ]);

    return result.map((item) => ({
      category: {
        _id: item._id,
        name: item.name,
        slug: item.slug,
        description: item.description,
        color: item.color,
        isActive: item.isActive,
        createdBy: item.createdBy,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
      quizCount: item.quizCount,
    }));
  }

  async getStatsWithQuizCount(): Promise<
    Array<{
      _id: string;
      name: string;
      description?: string;
      color: string;
      slug?: string;
      quizCount: number;
      isActive: boolean;
      createdBy: string;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    await connectDB();
    const result = await Category.aggregate([
      {
        $match: { isActive: true },
      },
      {
        $lookup: {
          from: 'quizzes',
          localField: '_id',
          foreignField: 'category',
          pipeline: [
            {
              $match: {
                status: 'published',
                isPrivate: { $ne: true },
              },
            },
            {
              $count: 'count',
            },
          ],
          as: 'quizzes',
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          color: 1,
          slug: {
            $toLower: {
              $replaceAll: {
                input: '$name',
                find: ' ',
                replacement: '-',
              },
            },
          },
          quizCount: {
            $ifNull: [{ $arrayElemAt: ['$quizzes.count', 0] }, 0],
          },
          isActive: 1,
          createdBy: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      {
        $sort: { quizCount: -1, name: 1 },
      },
    ]);

    return result;
  }
}
