import {
  buildQuizSearchKey,
  parseQuizVisibility,
  parseSearchPage,
  type QuizVisibilityFilter,
} from '@/features/explore/lib/search';

export type { QuizVisibilityFilter };

export const QUIZZES_PAGE_SIZE = 12;

export function parseQuizzesVisibility(value: string | null): QuizVisibilityFilter {
  return parseQuizVisibility(value);
}

export function parseQuizzesPage(value: string | null): number {
  return parseSearchPage(value);
}

/**
 * Maps the UI All/Public/Private control onto GET /api/quizzes query semantics.
 * "all" omits visibility so the API returns both public and private list items.
 */
export function buildQuizzesListApiKey({
  query,
  page,
  visibility,
  limit = QUIZZES_PAGE_SIZE,
}: {
  query: string;
  page: number;
  visibility: QuizVisibilityFilter;
  limit?: number;
}): string {
  return buildQuizSearchKey({
    query,
    page,
    mine: false,
    limit,
    visibility,
  });
}

export function buildQuizzesPageQueryString({
  q,
  page,
  visibility,
}: {
  q: string;
  page: number;
  visibility: QuizVisibilityFilter;
}): string {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (page > 1) params.set('page', String(page));
  if (visibility !== 'all') params.set('visibility', visibility);
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '?';
}
