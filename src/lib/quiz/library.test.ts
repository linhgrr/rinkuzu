import { describe, expect, it } from 'vitest';
import { resolveQuizLibraryActivity } from './library';

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
