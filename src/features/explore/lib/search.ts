import type { DashboardSubject } from '@/features/adaptive/types/dashboard-view-model';

export type SearchType = 'all' | 'mine' | 'adaptive' | 'quizzes';
export type QuizVisibilityFilter = 'all' | 'public' | 'private';

const SEARCH_TYPES: SearchType[] = ['all', 'mine', 'adaptive', 'quizzes'];
const QUIZ_VISIBILITY_FILTERS: QuizVisibilityFilter[] = ['all', 'public', 'private'];

export function parseSearchType(value: string | null): SearchType {
  return SEARCH_TYPES.includes(value as SearchType) ? (value as SearchType) : 'all';
}

export function parseSearchPage(value: string | null): number {
  const page = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function parseQuizVisibility(value: string | null): QuizVisibilityFilter {
  return QUIZ_VISIBILITY_FILTERS.includes(value as QuizVisibilityFilter)
    ? (value as QuizVisibilityFilter)
    : 'all';
}

export function buildQuizSearchKey({
  query,
  page,
  mine,
  limit,
  visibility = 'all',
}: {
  query: string;
  page: number;
  mine: boolean;
  limit: number;
  visibility?: QuizVisibilityFilter;
}): string {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (query) params.set('search', query);
  if (mine) params.set('mine', 'true');
  if (visibility !== 'all') params.set('visibility', visibility);
  return `/api/quizzes?${params.toString()}`;
}

export function filterAdaptiveSubjects(
  subjects: DashboardSubject[],
  query: string,
  locale: string,
): DashboardSubject[] {
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  if (!normalizedQuery) return subjects;

  return subjects.filter((subject) =>
    [subject.displayTitle, subject.subjectId, subject.filename].some((value) =>
      value.toLocaleLowerCase(locale).includes(normalizedQuery),
    ),
  );
}
