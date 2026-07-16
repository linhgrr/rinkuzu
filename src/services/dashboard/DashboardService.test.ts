import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IDashboardRepository } from '@/interfaces/repositories/IDashboardRepository';
import type { IDashboardQuizRepository } from '@/interfaces/repositories/IDashboardQuizRepository';
import { fetchApiData } from '@/lib/api/client';
import { DashboardService } from '@/services/dashboard/DashboardService';

vi.mock('@/lib/api/client', () => ({
  fetchApiData: vi.fn(),
}));

vi.mock('@/lib/adaptive/config', () => ({
  buildAdaptiveServiceHeaders: vi.fn(() => ({ 'x-user-id': 'user-1' })),
  buildAdaptiveUrl: vi.fn((path: string) => `https://adaptive.example.test/api/v1${path}`),
  resolveAdaptiveProxyTimeoutMs: vi.fn(() => 1_500),
}));

const now = new Date('2026-07-01T00:00:00Z');

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
      { isPrivate: false, excludeAuthor: 'user-1' },
      expect.objectContaining({ limit: 4, populate: ['author'] }),
    );
  });
});
