import { describe, expect, it } from 'vitest';
import { matchesLibraryFolder, matchesLibraryStatus, resolveQuizLibraryActivity } from './library';

describe('quiz library activity', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const attemptedAt = new Date('2026-02-01T00:00:00.000Z');
  const progressAt = new Date('2026-03-01T00:00:00.000Z');

  it('uses progress as the most recent activity', () => {
    expect(resolveQuizLibraryActivity(createdAt, attemptedAt, progressAt)).toEqual({
      libraryStatus: 'in_progress',
      displayDate: progressAt.toISOString(),
    });
  });

  it('uses the last attempt for a completed quiz', () => {
    expect(resolveQuizLibraryActivity(createdAt, attemptedAt)).toEqual({
      libraryStatus: 'complete',
      displayDate: attemptedAt.toISOString(),
    });
  });

  it('uses creation for a quiz that has not been started', () => {
    expect(resolveQuizLibraryActivity(createdAt)).toEqual({
      libraryStatus: 'not_started',
      displayDate: createdAt.toISOString(),
    });
  });
});

describe('quiz library folder filtering', () => {
  it('includes every folder when no filter is provided', () => {
    expect(matchesLibraryFolder('folder-1', undefined)).toBe(true);
  });

  it('matches only unfiled quizzes for the null domain filter', () => {
    expect(matchesLibraryFolder(null, null)).toBe(true);
    expect(matchesLibraryFolder('folder-1', null)).toBe(false);
  });

  it('matches a concrete folder id', () => {
    expect(matchesLibraryFolder('folder-1', 'folder-1')).toBe(true);
    expect(matchesLibraryFolder('folder-2', 'folder-1')).toBe(false);
  });
});

describe('quiz library status filtering', () => {
  it('shows every status in the all view', () => {
    expect(matchesLibraryStatus(undefined, 'all')).toBe(true);
  });

  it('only matches the selected activity status', () => {
    expect(matchesLibraryStatus('in_progress', 'in_progress')).toBe(true);
    expect(matchesLibraryStatus('complete', 'in_progress')).toBe(false);
  });
});
