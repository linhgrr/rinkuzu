import { describe, expect, it } from 'vitest';
import {
  buildQuizzesListApiKey,
  buildQuizzesPageQueryString,
  parseQuizzesPage,
} from './quizzes-page-state';

describe('quizzes page state', () => {
  it('builds public community list API keys without personal visibility filters', () => {
    expect(buildQuizzesListApiKey({ query: '', page: 1 })).toBe('/api/quizzes?page=1&limit=12');
    expect(
      buildQuizzesListApiKey({
        query: 'linear algebra',
        page: 2,
      }),
    ).toBe('/api/quizzes?page=2&limit=12&search=linear+algebra');
  });

  it('preserves pagination and search URL semantics', () => {
    expect(parseQuizzesPage(null)).toBe(1);
    expect(parseQuizzesPage('0')).toBe(1);
    expect(parseQuizzesPage('4')).toBe(4);

    expect(buildQuizzesPageQueryString({ q: '', page: 1 })).toBe('?');
    expect(buildQuizzesPageQueryString({ q: ' calculus ', page: 3 })).toBe('?q=calculus&page=3');
  });
});
