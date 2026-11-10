import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IReportRepository } from '@/interfaces/repositories/IReportRepository';
import type { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import type { IRecentUserRepository } from '@/interfaces/repositories/IRecentUserRepository';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { IDashboardQuizRepository } from '@/interfaces/repositories/IDashboardQuizRepository';
import type { IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository';
import { AdminService } from '@/services/admin/AdminService';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

/** Report list and status wiring to the quiz-level moderation port (RIN-1343). */
describe('AdminService report moderation wiring', () => {
  const findAll = vi.fn();
  const findById = vi.fn();
  const update = vi.fn();
  const reportRepository: IReportRepository = {
    findAll,
    findById,
    update,
    create: vi.fn(),
    delete: vi.fn(),
  };
  const moderation = {
    countPendingIndexHold: vi.fn<() => Promise<number>>(),
    syncIndexHold: vi.fn(),
  };
  const service = new AdminService(
    {} as IUserRepository & IRecentUserRepository,
    reportRepository,
    {} as IQuizRepository & IDashboardQuizRepository,
    {} as IAttemptRepository,
    undefined,
    moderation,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    moderation.countPendingIndexHold.mockResolvedValue(2);
    moderation.syncIndexHold.mockResolvedValue(undefined);
    findAll.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it('lists with the reason filter and the pending hold count', async () => {
    const result = await service.getReports({
      page: 1,
      limit: 20,
      status: 'all',
      reason: 'copyright',
    });

    expect(findAll).toHaveBeenCalledWith({ page: 1, limit: 20, reason: 'copyright' });
    expect(result).toMatchObject({ success: true, data: { pendingIndexHoldCount: 2 } });
  });

  it('syncs the index hold with the updated report', async () => {
    const updated = { id: 'r1', quizId: 'q1', reason: 'copyright', status: 'dismissed' };
    findById.mockResolvedValue({ id: 'r1', quizId: 'q1', reason: 'copyright' });
    update.mockResolvedValue(updated);

    await service.updateReportStatus(
      '507f191e810c19729de860ea',
      { status: 'dismissed' },
      'admin@example.com',
    );

    expect(moderation.syncIndexHold).toHaveBeenCalledWith(updated, 'dismissed');
  });
});
