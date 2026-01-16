import { cache } from 'react';
import connectDB from '@/lib/mongoose';
import Quiz from '@/models/Quiz';

export interface CachedQuiz {
  _id: string;
  title: string;
  description: string;
  slug: string;
  category: {
    _id: string;
    name: string;
    color: string;
  } | null;
  questionCount: number;
  createdAt: string;
}

/**
 * Cached published quizzes fetcher - deduplicates during SSR
 */
export const getPublishedQuizzes = cache(async (limit?: number): Promise<CachedQuiz[]> => {
  await connectDB();

  let query = Quiz.find({ status: 'published' })
    .populate('category', 'name color')
    .select('title description slug category questions createdAt')
    .sort({ createdAt: -1 })
    .lean();

  if (limit) {
    query = query.limit(limit);
  }

  const quizzes = await query.exec();

  return quizzes.map((quiz: any) => ({
    _id: quiz._id.toString(),
    title: quiz.title,
    description: quiz.description || '',
    slug: quiz.slug,
    category: quiz.category ? {
      _id: quiz.category._id.toString(),
      name: quiz.category.name,
      color: quiz.category.color,
    } : null,
    questionCount: quiz.questions?.length || 0,
    createdAt: quiz.createdAt.toISOString(),
  }));
});

/**
 * Cached quiz fetcher by slug
 */
export const getQuizBySlug = cache(async (slug: string): Promise<CachedQuiz | null> => {
  await connectDB();

  const quiz = await Quiz.findOne({ slug, status: 'published' })
    .populate('category', 'name color')
    .select('title description slug category questions createdAt')
    .lean()
    .exec();

  if (!quiz) return null;

  return {
    _id: (quiz as any)._id.toString(),
    title: (quiz as any).title,
    description: (quiz as any).description || '',
    slug: (quiz as any).slug,
    category: (quiz as any).category ? {
      _id: (quiz as any).category._id.toString(),
      name: (quiz as any).category.name,
      color: (quiz as any).category.color,
    } : null,
    questionCount: (quiz as any).questions?.length || 0,
    createdAt: (quiz as any).createdAt.toISOString(),
  };
});

/**
 * Cached quizzes by category
 */
export const getQuizzesByCategory = cache(async (
  categoryId: string,
  limit?: number
): Promise<CachedQuiz[]> => {
  await connectDB();

  let query = Quiz.find({ category: categoryId, status: 'published' })
    .populate('category', 'name color')
    .select('title description slug category questions createdAt')
    .sort({ createdAt: -1 })
    .lean();

  if (limit) {
    query = query.limit(limit);
  }

  const quizzes = await query.exec();

  return quizzes.map((quiz: any) => ({
    _id: quiz._id.toString(),
    title: quiz.title,
    description: quiz.description || '',
    slug: quiz.slug,
    category: quiz.category ? {
      _id: quiz.category._id.toString(),
      name: quiz.category.name,
      color: quiz.category.color,
    } : null,
    questionCount: quiz.questions?.length || 0,
    createdAt: quiz.createdAt.toISOString(),
  }));
});

/**
 * Cached featured/popular quizzes
 */
export const getFeaturedQuizzes = cache(async (limit: number = 6): Promise<CachedQuiz[]> => {
  await connectDB();

  // Get quizzes with most attempts (popular)
  const quizzes = await Quiz.aggregate([
    { $match: { status: 'published' } },
    {
      $lookup: {
        from: 'attempts',
        localField: '_id',
        foreignField: 'quiz',
        as: 'attempts'
      }
    },
    {
      $addFields: {
        attemptCount: { $size: '$attempts' }
      }
    },
    { $sort: { attemptCount: -1, createdAt: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'categoryInfo'
      }
    },
    {
      $project: {
        title: 1,
        description: 1,
        slug: 1,
        createdAt: 1,
        questionCount: { $size: { $ifNull: ['$questions', []] } },
        category: { $arrayElemAt: ['$categoryInfo', 0] }
      }
    }
  ]);

  return quizzes.map((quiz: any) => ({
    _id: quiz._id.toString(),
    title: quiz.title,
    description: quiz.description || '',
    slug: quiz.slug,
    category: quiz.category ? {
      _id: quiz.category._id.toString(),
      name: quiz.category.name,
      color: quiz.category.color,
    } : null,
    questionCount: quiz.questionCount,
    createdAt: quiz.createdAt.toISOString(),
  }));
});
