import { describe, expect, it } from 'vitest';
import {
  buildQuizzesListApiKey,
  buildQuizzesPageQueryString,
  parseQuizzesPage,
  parseQuizzesVisibility,
} from './quizzes-page-state';

describe('quizzes page state', () => {
  it('maps All / Public / Private visibility onto list API keys', () => {
    expect(buildQuizzesListApiKey({ query: '', page: 1, visibility: 'all' })).toBe(
      '/api/quizzes?page=1&limit=12',
    );

    expect(buildQuizzesListApiKey({ query: '', page: 1, visibility: 'public' })).toBe(
      '/api/quizzes?page=1&limit=12&visibility=public',
    );

    expect(
      buildQuizzesListApiKey({
        query: 'linear algebra',
        page: 2,
        visibility: 'private',
      }),
    ).toBe('/api/quizzes?page=2&limit=12&search=linear+algebra&visibility=private');
  });

  it('preserves pagination and search URL semantics', () => {
    expect(parseQuizzesVisibility(null)).toBe('all');
    expect(parseQuizzesVisibility('private')).toBe('private');
    expect(parseQuizzesVisibility('unknown')).toBe('all');
    expect(parseQuizzesPage(null)).toBe(1);
    expect(parseQuizzesPage('0')).toBe(1);
    expect(parseQuizzesPage('4')).toBe(4);

    expect(buildQuizzesPageQueryString({ q: '', page: 1, visibility: 'all' })).toBe('?');
    expect(buildQuizzesPageQueryString({ q: ' calculus ', page: 3, visibility: 'public' })).toBe(
      '?q=calculus&page=3&visibility=public',
    );
    expect(buildQuizzesPageQueryString({ q: '', page: 1, visibility: 'private' })).toBe(
      '?visibility=private',
    );
  });
});
