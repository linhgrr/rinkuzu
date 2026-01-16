/**
 * Server-side caching utilities using React.cache
 *
 * These functions automatically deduplicate requests during a single render pass.
 * Use them in Server Components for optimal performance.
 *
 * @example
 * // In a Server Component
 * import { getCategories, getFeaturedQuizzes } from '@/lib/cache';
 *
 * export default async function HomePage() {
 *   const [categories, quizzes] = await Promise.all([
 *     getCategories(),
 *     getFeaturedQuizzes(6)
 *   ]);
 *
 *   return <div>...</div>;
 * }
 */

// Base utilities
export { getDB, cachedFetch, cachedInternalFetch } from '../cache';

// Categories
export {
  getCategories,
  getCategoryBySlug,
  getCategoriesWithStats,
  type CachedCategory,
} from './categories';

// Quizzes
export {
  getPublishedQuizzes,
  getQuizBySlug,
  getQuizzesByCategory,
  getFeaturedQuizzes,
  type CachedQuiz,
} from './quizzes';
