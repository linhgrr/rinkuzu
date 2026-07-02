import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IDashboardRepository } from '@/interfaces/repositories/IDashboardRepository';
import { fetchApiData } from '@/lib/api/client';
import { DashboardService } from '@/services/dashboard/DashboardService';

vi.mock('@/lib/api/client', () => ({
  fetchApiData: vi.fn(),
}));

vi.mock('@/lib/adaptive/config', () => ({
  buildAdaptiveServiceHeaders: vi.fn(() => ({ 'x-user-id': 'user-1' })),
  resolveAdaptiveApiUrl: vi.fn(() => 'https://adaptive.example.test'),
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

describe('DashboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchApiData).mockResolvedValue({
      subjects: [{ job_id: 'job-1', status: 'completed' }],
    });
  });

  it('builds a fully typed dashboard bootstrap DTO', async () => {
    const repository = createRepository();
    const service = new DashboardService(repository);

    const result = await service.getBootstrapData('user-1');

    expect(result.stats.dueCount).toBe(0);
    expect(result.inProgressQuizzes[0]?.updatedAt).toBe(now.toISOString());
    expect(result.adaptiveSubjects).toEqual([
      expect.objectContaining({ job_id: 'job-1', status: 'completed' }),
    ]);
  });
});
