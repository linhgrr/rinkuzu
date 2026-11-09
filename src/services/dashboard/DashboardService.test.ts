import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IDashboardRepository } from '@/interfaces/repositories/IDashboardRepository';
import type { IDashboardQuizRepository } from '@/interfaces/repositories/IDashboardQuizRepository';
import type {
  IStarterQuizReadRepository,
  StarterQuizCandidateRecord,
  StarterQuizEntryRecord,
} from '@/interfaces/repositories/IStarterQuizReadRepository';
import { fetchApiData } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import { DashboardService } from '@/services/dashboard/DashboardService';

vi.mock('@/lib/api/client', () => ({
  fetchApiData: vi.fn(),
}));

vi.mock('@/lib/adaptive/config', () => ({
  buildAdaptiveServiceHeaders: vi.fn(() => ({ 'x-user-id': 'user-1' })),
  buildAdaptiveUrl: vi.fn((path: string) => `https://adaptive.example.test/api${path}`),
  resolveAdaptiveProxyTimeoutMs: vi.fn(() => 1_500),
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const now = new Date('2026-07-01T00:00:00Z');

function candidate(
  slug: string,
  extra: Partial<StarterQuizCandidateRecord> = {},
): StarterQuizCandidateRecord {
  return {
    quizId: `id-${slug}`,
    slug,
    title: `Fake ${slug}`,
    visibility: 'public',
    questionCount: 7,
    isPremium: false,
    personalDataFlagged: false,
    indexHold: false,
    ...extra,
  };
}

function entry(slug: string, locale: string, order: number): StarterQuizEntryRecord {
  return { quizId: `id-${slug}`, locale, order };
}

const starterEntries = [entry('fake-starter-a', 'vi', 1), entry('fake-starter-gone', 'en', 2)];

function createStarters(
  entries: StarterQuizEntryRecord[] = starterEntries,
  candidates: StarterQuizCandidateRecord[] = [
    candidate('fake-starter-a', { title: 'Fake starter', questionCount: 10 }),
  ],
) {
  return {
    listStarterQuizEntries: vi.fn().mockResolvedValue(entries),
    findStarterQuizCandidates: vi.fn().mockResolvedValue(candidates),
  } satisfies IStarterQuizReadRepository;
}

function createRepository(): IDashboardRepository {
  return {
    findUserProgress: vi.fn().mockResolvedValue(null),
    countDueQuestions: vi.fn().mockResolvedValue(0),
    findInProgressQuizzes: vi.fn().mockResolvedValue([
      {
        quizId: 'progress',
        title: 'Progress',
        slug: 'progress',
        answeredCount: 1,
        totalQuestions: 2,
        updatedAt: now,
      },
    ]),
    hasSubmittedAttempt: vi.fn().mockResolvedValue(false),
    hasAuthoredQuiz: vi.fn().mockResolvedValue(false),
  };
}

function createQuizRepository(): IDashboardQuizRepository {
  return {
    findRecent: vi.fn().mockResolvedValue([]),
  };
}

describe('DashboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchApiData).mockResolvedValue({
      subjects: [{ job_id: 'job-1', status: 'completed' }],
    });
  });

  it('builds a fully typed dashboard bootstrap DTO', async () => {
    const repository = createRepository();
    const quizRepository = createQuizRepository();
    const service = new DashboardService(repository, quizRepository, createStarters());

    const result = await service.getBootstrapData('user-1');

    expect(result.stats.dueCount).toBe(0);
    expect(result.inProgressQuizzes[0]?.updatedAt).toBe(now.toISOString());
    expect(result.adaptiveSubjects).toEqual([
      expect.objectContaining({ job_id: 'job-1', status: 'completed' }),
    ]);
    expect(result.recentOwnedQuizzes).toEqual([]);
    expect(result.recentPublicQuizzes).toEqual([]);
    expect(quizRepository.findRecent).toHaveBeenNthCalledWith(
      1,
      { author: 'user-1' },
      expect.objectContaining({ limit: 4, populate: ['author'] }),
    );
    expect(quizRepository.findRecent).toHaveBeenNthCalledWith(
      2,
      { visibility: 'public', excludeAuthor: 'user-1' },
      expect.objectContaining({ limit: 4, populate: ['author'] }),
    );
  });

  describe('starter quizzes for new learners', () => {
    it('marks a user with no attempts and no quizzes as new and resolves starters', async () => {
      const repository = createRepository();
      const starters = createStarters();
      const service = new DashboardService(repository, createQuizRepository(), starters);

      const result = await service.getBootstrapData('user-1');

      expect(result.isNewLearner).toBe(true);
      expect(result.starterQuizzes).toEqual([
        {
          slug: 'fake-starter-a',
          title: 'Fake starter',
          questionCount: 10,
          locale: 'vi',
          quick: false,
        },
      ]);
      expect(repository.hasSubmittedAttempt).toHaveBeenCalledWith('user-1');
      expect(repository.hasAuthoredQuiz).toHaveBeenCalledWith('user-1');
      expect(starters.findStarterQuizCandidates).toHaveBeenCalledWith([
        'id-fake-starter-a',
        'id-fake-starter-gone',
      ]);
    });

    it('logs each dropped starter by quiz id only', async () => {
      const service = new DashboardService(
        createRepository(),
        createQuizRepository(),
        createStarters(),
      );

      await service.getBootstrapData('user-1');

      const dropLogs = vi
        .mocked(logger.warn)
        .mock.calls.filter(([, message]) => String(message).includes('Dropped'));
      expect(dropLogs).toEqual([
        [{ quizId: 'id-fake-starter-gone', reason: 'missing' }, expect.any(String)],
      ]);
      expect(JSON.stringify(dropLogs)).not.toContain('user-1');
    });

    it.each([
      ['a submitted attempt', 'hasSubmittedAttempt'],
      ['an authored quiz', 'hasAuthoredQuiz'],
    ] as const)('graduates a learner with %s', async (_label, method) => {
      const repository = createRepository();
      vi.mocked(repository[method]).mockResolvedValue(true);
      const service = new DashboardService(repository, createQuizRepository(), createStarters());

      const result = await service.getBootstrapData('user-1');

      expect(result.isNewLearner).toBe(false);
      expect(result.starterQuizzes).toEqual([]);
    });

    it('fails open to the current dashboard when a lookup throws', async () => {
      const starters = createStarters();
      starters.listStarterQuizEntries.mockRejectedValue(new Error('db down'));
      const service = new DashboardService(createRepository(), createQuizRepository(), starters);

      const result = await service.getBootstrapData('user-1');

      expect(result.isNewLearner).toBe(false);
      expect(result.starterQuizzes).toEqual([]);
      expect(result.inProgressQuizzes).toHaveLength(1);
    });
  });
});

// RIN-913: the post-sign-in landing sends a new learner straight into a starter quiz.
describe('DashboardService.getPostSignInHref', () => {
  const twoLocaleEntries = [entry('fake-starter-vi', 'vi', 1), entry('fake-starter-en', 'en', 2)];

  function createTwoLocaleStarters() {
    return createStarters(twoLocaleEntries, [
      candidate('fake-starter-vi'),
      candidate('fake-starter-en'),
    ]);
  }

  it.each([
    { locale: 'vi', slug: 'fake-starter-vi' },
    { locale: 'en', slug: 'fake-starter-en' },
  ])('sends a new $locale learner to the $locale starter quiz', async ({ locale, slug }) => {
    const service = new DashboardService(
      createRepository(),
      createQuizRepository(),
      createTwoLocaleStarters(),
    );

    await expect(
      service.getPostSignInHref({ userId: 'user-1', locale, starterSkipped: false }),
    ).resolves.toBe(`/quiz/${slug}?entry=post_signin_starter`);
  });

  it('opens a long starter as a quick round', async () => {
    const starters = createStarters(
      [entry('fake-long', 'vi', 1)],
      [candidate('fake-long', { questionCount: 40 })],
    );
    const service = new DashboardService(createRepository(), createQuizRepository(), starters);

    await expect(
      service.getPostSignInHref({ userId: 'user-1', locale: 'vi', starterSkipped: false }),
    ).resolves.toBe('/quiz/fake-long?mode=quick&entry=post_signin_starter');
  });

  it('falls back to the first starter when none matches the UI locale', async () => {
    const service = new DashboardService(
      createRepository(),
      createQuizRepository(),
      createTwoLocaleStarters(),
    );

    await expect(
      service.getPostSignInHref({ userId: 'user-1', locale: 'ja', starterSkipped: false }),
    ).resolves.toBe('/quiz/fake-starter-vi?entry=post_signin_starter');
  });

  it.each([
    { label: 'a submitted attempt', key: 'hasSubmittedAttempt' as const },
    { label: 'an authored quiz', key: 'hasAuthoredQuiz' as const },
  ])('keeps a returning learner with $label on the dashboard', async ({ key }) => {
    const repository = createRepository();
    vi.mocked(repository[key]).mockResolvedValue(true);
    const service = new DashboardService(
      repository,
      createQuizRepository(),
      createTwoLocaleStarters(),
    );

    await expect(
      service.getPostSignInHref({ userId: 'user-1', locale: 'vi', starterSkipped: false }),
    ).resolves.toBe('/dashboard');
  });

  it('lands on the dashboard when no starter resolves', async () => {
    const starters = createStarters(twoLocaleEntries, []);
    const service = new DashboardService(createRepository(), createQuizRepository(), starters);

    await expect(
      service.getPostSignInHref({ userId: 'user-1', locale: 'vi', starterSkipped: false }),
    ).resolves.toBe('/dashboard');
  });

  it('lands on the dashboard with no starter rows', async () => {
    const service = new DashboardService(
      createRepository(),
      createQuizRepository(),
      createStarters([], []),
    );

    await expect(
      service.getPostSignInHref({ userId: 'user-1', locale: 'vi', starterSkipped: false }),
    ).resolves.toBe('/dashboard');
  });

  it('fails open to the dashboard when a lookup throws', async () => {
    const repository = createRepository();
    vi.mocked(repository.hasSubmittedAttempt).mockRejectedValue(new Error('db down'));
    const service = new DashboardService(
      repository,
      createQuizRepository(),
      createTwoLocaleStarters(),
    );

    await expect(
      service.getPostSignInHref({ userId: 'user-1', locale: 'vi', starterSkipped: false }),
    ).resolves.toBe('/dashboard');
  });

  it('honours the skip cookie without touching the database', async () => {
    const repository = createRepository();
    const starters = createTwoLocaleStarters();
    const service = new DashboardService(repository, createQuizRepository(), starters);

    await expect(
      service.getPostSignInHref({ userId: 'user-1', locale: 'vi', starterSkipped: true }),
    ).resolves.toBe('/dashboard');
    expect(repository.hasSubmittedAttempt).not.toHaveBeenCalled();
    expect(starters.listStarterQuizEntries).not.toHaveBeenCalled();
  });
});
