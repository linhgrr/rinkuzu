import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IDashboardRepository } from '@/interfaces/repositories/IDashboardRepository';
import type { IDashboardQuizRepository } from '@/interfaces/repositories/IDashboardQuizRepository';
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

const starterAllowlist = [
  { slug: 'fake-starter-a', locale: 'vi' },
  { slug: 'fake-starter-gone', locale: 'en' },
];

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
    findStarterQuizCandidates: vi.fn().mockResolvedValue([
      {
        slug: 'fake-starter-a',
        title: 'Fake starter',
        visibility: 'public',
        questionCount: 10,
        isPremium: false,
      },
    ]),
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
    const service = new DashboardService(repository, quizRepository);

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
      const service = new DashboardService(repository, createQuizRepository(), starterAllowlist);

      const result = await service.getBootstrapData('user-1');

      expect(result.isNewLearner).toBe(true);
      expect(result.starterQuizzes).toEqual([
        { slug: 'fake-starter-a', title: 'Fake starter', questionCount: 10, locale: 'vi' },
      ]);
      expect(repository.hasSubmittedAttempt).toHaveBeenCalledWith('user-1');
      expect(repository.hasAuthoredQuiz).toHaveBeenCalledWith('user-1');
      expect(repository.findStarterQuizCandidates).toHaveBeenCalledWith([
        'fake-starter-a',
        'fake-starter-gone',
      ]);
    });

    it('logs each dropped allowlist entry by slug only', async () => {
      const service = new DashboardService(
        createRepository(),
        createQuizRepository(),
        starterAllowlist,
      );

      await service.getBootstrapData('user-1');

      const dropLogs = vi
        .mocked(logger.warn)
        .mock.calls.filter(([, message]) => String(message).includes('Dropped starter quiz'));
      expect(dropLogs).toEqual([
        [{ slug: 'fake-starter-gone', reason: 'missing' }, expect.any(String)],
      ]);
      expect(JSON.stringify(dropLogs)).not.toContain('user-1');
    });

    it.each([
      ['a submitted attempt', 'hasSubmittedAttempt'],
      ['an authored quiz', 'hasAuthoredQuiz'],
    ] as const)('graduates a learner with %s', async (_label, method) => {
      const repository = createRepository();
      vi.mocked(repository[method]).mockResolvedValue(true);
      const service = new DashboardService(repository, createQuizRepository(), starterAllowlist);

      const result = await service.getBootstrapData('user-1');

      expect(result.isNewLearner).toBe(false);
      expect(result.starterQuizzes).toEqual([]);
    });

    it('fails open to the current dashboard when a lookup throws', async () => {
      const repository = createRepository();
      vi.mocked(repository.findStarterQuizCandidates).mockRejectedValue(new Error('db down'));
      const service = new DashboardService(repository, createQuizRepository(), starterAllowlist);

      const result = await service.getBootstrapData('user-1');

      expect(result.isNewLearner).toBe(false);
      expect(result.starterQuizzes).toEqual([]);
      expect(result.inProgressQuizzes).toHaveLength(1);
    });
  });
});
