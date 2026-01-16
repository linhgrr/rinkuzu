import { cache } from 'react';
import connectDB from '@/lib/mongoose';
import Category from '@/models/Category';

export interface CachedCategory {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  color: string;
  quizCount?: number;
}

/**
 * Cached category fetcher - deduplicates during SSR
 * Use this in Server Components to fetch categories
 */
export const getCategories = cache(async (): Promise<CachedCategory[]> => {
  await connectDB();

  const categories = await Category.find({ isActive: true })
    .select('name slug description color')
    .lean()
    .exec();

  return categories.map((cat: any) => ({
    _id: cat._id.toString(),
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    color: cat.color,
  }));
});

/**
 * Cached single category fetcher by slug
 */
export const getCategoryBySlug = cache(async (slug: string): Promise<CachedCategory | null> => {
  await connectDB();

  const category = await Category.findOne({ slug, isActive: true })
    .select('name slug description color')
    .lean()
    .exec();

  if (!category) return null;

  return {
    _id: (category as any)._id.toString(),
    name: (category as any).name,
    slug: (category as any).slug,
    description: (category as any).description,
    color: (category as any).color,
  };
});

/**
 * Cached categories with quiz count
 */
export const getCategoriesWithStats = cache(async (): Promise<CachedCategory[]> => {
  await connectDB();

  const categories = await Category.aggregate([
    { $match: { isActive: true } },
    {
      $lookup: {
        from: 'quizzes',
        localField: '_id',
        foreignField: 'category',
        as: 'quizzes',
        pipeline: [
          { $match: { status: 'published' } },
          { $project: { _id: 1 } }
        ]
      }
    },
    {
      $project: {
        name: 1,
        slug: 1,
        description: 1,
        color: 1,
        quizCount: { $size: '$quizzes' }
      }
    },
    { $sort: { quizCount: -1 } }
  ]);

  return categories.map((cat: any) => ({
    _id: cat._id.toString(),
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    color: cat.color,
    quizCount: cat.quizCount,
  }));
});
