import { buildQuizSearchKey, parseSearchPage } from '@/features/explore/lib/search';

export const QUIZZES_PAGE_SIZE = 12;

export function parseQuizzesPage(value: string | null): number {
  return parseSearchPage(value);
}

/**
 * Builds the public community quiz query. Personal source metadata is only
 * available through authenticated owner surfaces.
 */
export function buildQuizzesListApiKey({
  query,
  page,
  limit = QUIZZES_PAGE_SIZE,
}: {
  query: string;
  page: number;
  limit?: number;
}): string {
  return buildQuizSearchKey({
    query,
    page,
    mine: false,
    limit,
  });
}

export function buildQuizzesPageQueryString({ q, page }: { q: string; page: number }): string {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (page > 1) params.set('page', String(page));
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '?';
}
