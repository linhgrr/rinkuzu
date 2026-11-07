import { describe, expect, it } from 'vitest';
import { buildQuizShareUrl, quizShareMode } from './quiz-share';

const UTM = 'utm_source=share&utm_medium=result&utm_campaign=quiz-share';

describe('buildQuizShareUrl', () => {
  it('builds the canonical public quiz URL with the share UTM parameters', () => {
    expect(buildQuizShareUrl({ slug: 'sinh-hoc-10', locale: 'vi', questionCount: 12 })).toBe(
      `http://localhost:3000/vi/quiz/sinh-hoc-10?${UTM}`,
    );
  });

  it('uses the locale path', () => {
    expect(buildQuizShareUrl({ slug: 'biology', locale: 'en', questionCount: 12 })).toBe(
      `http://localhost:3000/en/quiz/biology?${UTM}`,
    );
  });

  it('adds mode=quick only above 15 questions', () => {
    const at15 = new URL(buildQuizShareUrl({ slug: 'q', locale: 'en', questionCount: 15 }));
    const at16 = new URL(buildQuizShareUrl({ slug: 'q', locale: 'en', questionCount: 16 }));

    expect(at15.searchParams.has('mode')).toBe(false);
    expect(at16.searchParams.get('mode')).toBe('quick');
    expect(at16.searchParams.get('utm_source')).toBe('share');
  });

  it('encodes the slug as one path segment', () => {
    const url = buildQuizShareUrl({ slug: 'đề thi/1?x', locale: 'vi', questionCount: 3 });

    expect(url).toBe(`http://localhost:3000/vi/quiz/${encodeURIComponent('đề thi/1?x')}?${UTM}`);
    expect(new URL(url).pathname.split('/')).toHaveLength(4);
  });

  it('carries no attempt, score or user data', () => {
    const url = new URL(buildQuizShareUrl({ slug: 'q', locale: 'en', questionCount: 40 }));

    expect([...url.searchParams.keys()].sort()).toEqual([
      'mode',
      'utm_campaign',
      'utm_medium',
      'utm_source',
    ]);
  });
});

describe('quizShareMode', () => {
  it('is quick above 15 questions and full otherwise', () => {
    expect(quizShareMode(15)).toBe('full');
    expect(quizShareMode(16)).toBe('quick');
  });
});
