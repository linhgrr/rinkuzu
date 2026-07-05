import { describe, expect, it } from 'vitest';
import {
  buildQuizSearchKey,
  filterAdaptiveSubjects,
  parseSearchPage,
  parseSearchType,
} from '@/features/explore/lib/search';
import type { DashboardSubject } from '@/features/adaptive/types/dashboard-view-model';

const subject = {
  jobId: 'job-1',
  filename: 'linear-algebra.pdf',
  subjectId: 'Đại số tuyến tính',
  displayTitle: 'Ma trận và vector',
} as DashboardSubject;

describe('explore search helpers', () => {
  it('normalizes unsupported URL state', () => {
    expect(parseSearchType('unknown')).toBe('all');
    expect(parseSearchPage('-2')).toBe(1);
    expect(parseSearchPage('3')).toBe(3);
  });

  it('builds quiz API keys without empty search parameters', () => {
    expect(buildQuizSearchKey({ query: '', page: 1, mine: false, limit: 12 })).toBe(
      '/api/quizzes?page=1&limit=12&compact=true',
    );
    expect(buildQuizSearchKey({ query: 'linear algebra', page: 2, mine: true, limit: 12 })).toBe(
      '/api/quizzes?page=2&limit=12&compact=true&search=linear+algebra&mine=true',
    );
  });

  it('matches adaptive lessons by title, subject, or filename', () => {
    expect(filterAdaptiveSubjects([subject], 'vector', 'vi')).toEqual([subject]);
    expect(filterAdaptiveSubjects([subject], 'đại số', 'vi')).toEqual([subject]);
    expect(filterAdaptiveSubjects([subject], 'linear-algebra', 'vi')).toEqual([subject]);
    expect(filterAdaptiveSubjects([subject], 'calculus', 'vi')).toEqual([]);
  });
});
