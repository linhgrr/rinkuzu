import { describe, expect, it } from 'vitest';
import {
  QUIZ_TOPIC_SLUG_PATTERN,
  countIntroWords,
  isTopicIndexable,
  isTopicIntroPublishable,
} from '@/shared/constants/quiz-topic';

function words(n: number): string {
  return Array.from({ length: n }, (_, i) => 'từ' + i).join(' ');
}

describe('quiz topic intro rules', () => {
  it('counts words across spaces, tabs and newlines', () => {
    expect(countIntroWords('  Ôn tập\nHóa học\t12  ')).toBe(5);
    expect(countIntroWords('')).toBe(0);
  });

  it.each([
    [119, false],
    [120, true],
    [400, true],
    [401, false],
  ])('an intro of %i words is publishable: %s', (n, expected) => {
    expect(isTopicIntroPublishable(words(n))).toBe(expected);
  });
});

describe('quiz topic slug pattern', () => {
  it.each(['hoa-hoc-12', 'sinh', 'toan-lop-10'])('accepts %s', (slug) => {
    expect(QUIZ_TOPIC_SLUG_PATTERN.test(slug)).toBe(true);
  });

  it.each(['Hoa-hoc', 'hóa-học', '-sinh', 'sinh-', 'a--b', 'a b', ''])('rejects %j', (slug) => {
    expect(QUIZ_TOPIC_SLUG_PATTERN.test(slug)).toBe(false);
  });
});

describe('isTopicIndexable', () => {
  const ready = { published: true, intro: words(150), indexableQuizCount: 3 };

  it('is true for a published topic with an intro and 3 indexable quizzes', () => {
    expect(isTopicIndexable(ready)).toBe(true);
  });

  it.each([
    ['unpublished', { published: false }],
    ['a short intro', { intro: words(119) }],
    ['a long intro', { intro: words(401) }],
    ['no intro', { intro: '' }],
    ['only 2 indexable quizzes', { indexableQuizCount: 2 }],
  ])('is false with %s', (_label, override) => {
    expect(isTopicIndexable({ ...ready, ...override })).toBe(false);
  });
});
