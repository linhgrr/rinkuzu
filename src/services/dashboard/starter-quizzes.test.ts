import { describe, expect, it } from 'vitest';
import type { DashboardStarterQuizCandidateRecord } from '@/interfaces/repositories/IDashboardRepository';
import {
  STARTER_QUIZ_ALLOWLIST,
  resolveStarterQuizzes,
} from '@/services/dashboard/starter-quizzes';

const STARTER_QUIZ_MAX_QUESTIONS = 15;

function candidate(
  overrides: Partial<DashboardStarterQuizCandidateRecord> & { slug: string },
): DashboardStarterQuizCandidateRecord {
  return {
    title: `Quiz ${overrides.slug}`,
    visibility: 'public',
    questionCount: 10,
    isPremium: false,
    ...overrides,
  };
}

const allowlist = [
  { slug: 'fake-starter-vi', locale: 'vi' },
  { slug: 'fake-missing', locale: 'en' },
  { slug: 'fake-private', locale: 'en' },
  { slug: 'fake-too-long', locale: 'en' },
  { slug: 'fake-premium', locale: 'en' },
  { slug: 'fake-starter-en', locale: 'en' },
];

describe('resolveStarterQuizzes', () => {
  it('keeps allowlist order and drops missing, private, too-long and premium entries', () => {
    const result = resolveStarterQuizzes({
      allowlist,
      candidates: [
        candidate({ slug: 'fake-starter-en', questionCount: STARTER_QUIZ_MAX_QUESTIONS }),
        candidate({ slug: 'fake-private', visibility: 'personal' }),
        candidate({ slug: 'fake-too-long', questionCount: STARTER_QUIZ_MAX_QUESTIONS + 1 }),
        candidate({ slug: 'fake-premium', isPremium: true }),
        candidate({ slug: 'fake-starter-vi', title: 'Fake VI quiz', questionCount: 8 }),
      ],
    });

    expect(result.starterQuizzes).toEqual([
      { slug: 'fake-starter-vi', title: 'Fake VI quiz', questionCount: 8, locale: 'vi' },
      {
        slug: 'fake-starter-en',
        title: 'Quiz fake-starter-en',
        questionCount: STARTER_QUIZ_MAX_QUESTIONS,
        locale: 'en',
      },
    ]);
    expect(result.dropped).toEqual([
      { slug: 'fake-missing', reason: 'missing' },
      { slug: 'fake-private', reason: 'not-public' },
      { slug: 'fake-too-long', reason: 'too-long' },
      { slug: 'fake-premium', reason: 'premium' },
    ]);
  });

  it('returns no starters when every entry is dropped', () => {
    const result = resolveStarterQuizzes({
      allowlist: [{ slug: 'fake-gone', locale: 'vi' }],
      candidates: [],
    });

    expect(result.starterQuizzes).toEqual([]);
    expect(result.dropped).toEqual([{ slug: 'fake-gone', reason: 'missing' }]);
  });

  it('drops a quiz without questions', () => {
    const result = resolveStarterQuizzes({
      allowlist: [{ slug: 'fake-empty', locale: 'vi' }],
      candidates: [candidate({ slug: 'fake-empty', questionCount: 0 })],
    });

    expect(result.starterQuizzes).toEqual([]);
  });

  it('ships the vi starter first, then the en starter, then the vi alternative', () => {
    expect(STARTER_QUIZ_ALLOWLIST).toEqual([
      { slug: 'cch-ghi-nh-nhng-g-bn-hc-quiz-khi-ng-7-cu-096007', locale: 'vi' },
      { slug: 'how-to-remember-what-you-study-7-question-starter-quiz-093947', locale: 'en' },
      { slug: 'ktpm-chng-6-p1-219991', locale: 'vi' },
    ]);
  });
});
