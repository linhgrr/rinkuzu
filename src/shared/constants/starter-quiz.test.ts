import { describe, expect, it } from 'vitest';
import {
  isBlogPostSlug,
  resolveQuizEntryAttribution,
  TRACKED_QUIZ_ENTRIES,
} from '@/shared/constants/starter-quiz';

describe('quiz entry attribution (RIN-1256)', () => {
  it('tracks quiz landing, hub and blog next to the earlier entries', () => {
    expect(TRACKED_QUIZ_ENTRIES).toEqual([
      'post_signin_starter',
      'activation_email',
      'landing',
      'quiz_landing',
      'hub',
      'blog',
      'explore',
      'quizzes',
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
  it('tracks the Explore and /quizzes play buttons, without a topic (RIN-1469)', () => {
    expect(resolveQuizEntryAttribution('explore', undefined, 'sinh-hoc')).toEqual({
      entry: 'explore',
    });
    expect(resolveQuizEntryAttribution('quizzes', 'some-post')).toEqual({ entry: 'quizzes' });
  });

  it('keeps a well-formed hub topic next to entry=hub only (RIN-1417)', () => {
    expect(resolveQuizEntryAttribution('hub', undefined, 'tieng-anh-lop-10')).toEqual({
      entry: 'hub',
      topic: 'tieng-anh-lop-10',
    });
    for (const topic of ['Upper', '-x', 'a--b', 'a b', '', 'a'.repeat(81), 7]) {
      expect(resolveQuizEntryAttribution('hub', undefined, topic)).toEqual({ entry: 'hub' });
    }
    expect(resolveQuizEntryAttribution('blog', 'p', 'tieng-anh')).toEqual({
      entry: 'blog',
      post: 'p',
    });
    expect(resolveQuizEntryAttribution('hub', 'some-post', 'toan')).toEqual({
      entry: 'hub',
      topic: 'toan',
    });
    expect(resolveQuizEntryAttribution('hub', undefined, 'a'.repeat(80))).toEqual({
      entry: 'hub',
      topic: 'a'.repeat(80),
    });
  });
});
