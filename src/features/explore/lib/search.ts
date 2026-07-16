import type { DashboardSubject } from '@/features/adaptive/types/dashboard-view-model';

export type SearchType = 'all' | 'mine' | 'adaptive' | 'public';

const SEARCH_TYPES: SearchType[] = ['all', 'mine', 'adaptive', 'public'];

export function parseSearchType(value: string | null): SearchType {
  return SEARCH_TYPES.includes(value as SearchType) ? (value as SearchType) : 'all';
}

export function parseSearchPage(value: string | null): number {
  const page = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function buildQuizSearchKey({
  query,
  page,
  mine,
  limit,
}: {
  query: string;
  page: number;
  mine: boolean;
  limit: number;
}): string {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (query) params.set('search', query);
  if (mine) params.set('mine', 'true');
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
