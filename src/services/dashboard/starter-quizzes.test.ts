import { describe, expect, it, vi } from 'vitest';
import type {
  StarterQuizCandidateRecord,
  StarterQuizEntryRecord,
} from '@/interfaces/repositories/IStarterQuizReadRepository';
import { loadStarterQuizzes, starterQuizHref } from '@/services/dashboard/starter-quizzes';

function candidate(
  overrides: Partial<StarterQuizCandidateRecord> & { quizId: string },
): StarterQuizCandidateRecord {
  return {
    slug: `slug-${overrides.quizId}`,
    title: `Quiz ${overrides.quizId}`,
    visibility: 'public',
    questionCount: 10,
    isPremium: false,
    personalDataFlagged: false,
    indexHold: false,
    ...overrides,
  };
}

function entry(quizId: string, locale: string, order: number): StarterQuizEntryRecord {
  return { quizId, locale, order };
}

function resolveStarterQuizzes(input: {
  entries: StarterQuizEntryRecord[];
  candidates: StarterQuizCandidateRecord[];
}) {
  return loadStarterQuizzes({
    listStarterQuizEntries: () => Promise.resolve(input.entries),
    findStarterQuizCandidates: () => Promise.resolve(input.candidates),
  });
}

const entries = [
  entry('fake-vi', 'vi', 1),
  entry('fake-missing', 'en', 2),
  entry('fake-private', 'en', 3),
  entry('fake-long', 'en', 4),
  entry('fake-premium', 'en', 5),
  entry('fake-empty', 'en', 6),
  entry('fake-en', 'en', 7),
];

describe('resolveStarterQuizzes', () => {
  it('keeps the stored order, takes the locale from the row and drops each ineligible quiz', async () => {
    const result = await resolveStarterQuizzes({
      entries,
      candidates: [
        candidate({ quizId: 'fake-en', questionCount: 15 }),
        candidate({ quizId: 'fake-private', visibility: 'personal' }),
        candidate({ quizId: 'fake-long', title: 'Long quiz', questionCount: 40 }),
        candidate({ quizId: 'fake-premium', isPremium: true }),
        candidate({ quizId: 'fake-empty', questionCount: 0 }),
        candidate({ quizId: 'fake-vi', title: 'Fake VI quiz', questionCount: 8 }),
      ],
    });

    expect(result.starterQuizzes).toEqual([
      { slug: 'slug-fake-vi', title: 'Fake VI quiz', questionCount: 8, locale: 'vi', quick: false },
      { slug: 'slug-fake-long', title: 'Long quiz', questionCount: 10, locale: 'en', quick: true },
      {
        slug: 'slug-fake-en',
        title: 'Quiz fake-en',
        questionCount: 15,
        locale: 'en',
        quick: false,
      },
    ]);
    expect(result.dropped).toEqual([
      { quizId: 'fake-missing', reason: 'missing' },
      { quizId: 'fake-private', reason: 'not-public' },
      { quizId: 'fake-premium', reason: 'premium' },
      { quizId: 'fake-empty', reason: 'empty' },
    ]);
  });

  // RIN-1341: the landing, dashboard and nudge starters never promote a quiz
  // flagged for personal data or under a report hold; RIN-1408 reports them as dropped.
  it('leaves out flagged and held starters and reports them as dropped', async () => {
    const result = await resolveStarterQuizzes({
      entries: [
        entry('fake-flagged', 'vi', 1),
        entry('fake-held', 'vi', 2),
        entry('fake-ok', 'vi', 3),
      ],
      candidates: [
        candidate({ quizId: 'fake-flagged', personalDataFlagged: true }),
        candidate({ quizId: 'fake-held', indexHold: true }),
        candidate({ quizId: 'fake-ok' }),
      ],
    });

    expect(result.starterQuizzes.map(({ slug }) => slug)).toEqual(['slug-fake-ok']);
    expect(result.dropped).toEqual([
      { quizId: 'fake-flagged', reason: 'personal-data' },
      { quizId: 'fake-held', reason: 'held' },
    ]);
  });

  it('returns no starters when every entry is dropped', async () => {
    const result = await resolveStarterQuizzes({
      entries: [entry('fake-gone', 'vi', 1)],
      candidates: [],
    });

    expect(result.starterQuizzes).toEqual([]);
    expect(result.dropped).toEqual([{ quizId: 'fake-gone', reason: 'missing' }]);
  });
});

describe('starterQuizHref', () => {
  it('adds mode=quick before any extra params for a quick starter only', () => {
    expect(starterQuizHref({ slug: 'short', quick: false })).toBe('/quiz/short');
    expect(starterQuizHref({ slug: 'long', quick: true })).toBe('/quiz/long?mode=quick');
    expect(starterQuizHref({ slug: 'long', quick: true }, { entry: 'post_signin' })).toBe(
      '/quiz/long?mode=quick&entry=post_signin',
    );
    expect(starterQuizHref({ slug: 'short', quick: false }, { entry: 'post_signin' })).toBe(
      '/quiz/short?entry=post_signin',
    );
  });
});

describe('loadStarterQuizzes', () => {
  it('looks the stored rows up by quiz id', async () => {
    const repository = {
      listStarterQuizEntries: vi.fn().mockResolvedValue([entry('fake-a', 'vi', 1)]),
      findStarterQuizCandidates: vi.fn().mockResolvedValue([candidate({ quizId: 'fake-a' })]),
    };

    const result = await loadStarterQuizzes(repository);

    expect(repository.findStarterQuizCandidates).toHaveBeenCalledWith(['fake-a']);
    expect(result.starterQuizzes.map(({ slug }) => slug)).toEqual(['slug-fake-a']);
  });

  it('skips the quiz lookup when there are no starter rows', async () => {
    const repository = {
      listStarterQuizEntries: vi.fn().mockResolvedValue([]),
      findStarterQuizCandidates: vi.fn(),
    };

    await expect(loadStarterQuizzes(repository)).resolves.toEqual({
      starterQuizzes: [],
      dropped: [],
    });
    expect(repository.findStarterQuizCandidates).not.toHaveBeenCalled();
  });
});
