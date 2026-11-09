import { describe, expect, it } from 'vitest';
import {
  isBlogPostSlug,
  resolveQuizEntryAttribution,
  TRACKED_QUIZ_ENTRIES,
} from '@/shared/constants/starter-quiz';

describe('quiz entry attribution (RIN-1256)', () => {
  it('tracks blog next to the earlier entries', () => {
    expect(TRACKED_QUIZ_ENTRIES).toEqual([
      'post_signin_starter',
      'activation_email',
      'landing',
      'blog',
    ]);
  });

  it('keeps a tracked entry and a well-formed blog post', () => {
    expect(resolveQuizEntryAttribution('blog', 'on-thi-toeic-2026')).toEqual({
      entry: 'blog',
      post: 'on-thi-toeic-2026',
    });
    expect(resolveQuizEntryAttribution('landing', undefined)).toEqual({ entry: 'landing' });
  });

  it('drops an unknown or non-string entry, and its post with it', () => {
    expect(resolveQuizEntryAttribution('newsletter', 'abc')).toEqual({});
    expect(resolveQuizEntryAttribution(['blog'], 'abc')).toEqual({});
    expect(resolveQuizEntryAttribution(undefined, 'abc')).toEqual({});
  });

  it('drops a malformed post but keeps the entry', () => {
    for (const post of ['Uppercase', '../x', 'a'.repeat(81), '', 'a b', 42]) {
      expect(resolveQuizEntryAttribution('blog', post)).toEqual({ entry: 'blog' });
    }
    expect(isBlogPostSlug('a'.repeat(80))).toBe(true);
  });

  it('drops a post when the entry is not blog', () => {
    expect(resolveQuizEntryAttribution('landing', 'some-post')).toEqual({ entry: 'landing' });
  });
});
