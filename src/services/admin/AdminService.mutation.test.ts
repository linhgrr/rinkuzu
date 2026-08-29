import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminService } from '@/services/admin/AdminService';
import type { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import type { IReportRepository } from '@/interfaces/repositories/IReportRepository';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository';
import type { IRecentUserRepository } from '@/interfaces/repositories/IRecentUserRepository';
import type { IDashboardQuizRepository } from '@/interfaces/repositories/IDashboardQuizRepository';
import type { User } from '@/entities/User';

const pagination = {
  currentPage: 1,
  totalPages: 1,
  totalItems: 1,
  itemsPerPage: 20,
  hasNextPage: false,
  hasPrevPage: false,
};

const adminUser: User = {
  id: '507f191e810c19729de860ea',
  email: 'admin@example.com',
  role: 'admin',
  disable: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const targetUser: User = {
  id: '507f191e810c19729de860eb',
  email: 'learner@example.com',
  role: 'user',
  disable: 0,
  createdAt: new Date('2026-02-01T00:00:00.000Z'),
  displayName: 'Learner',
};

function createUserRepository(
  overrides: Partial<IUserRepository & IRecentUserRepository> = {},
): IUserRepository & IRecentUserRepository {
  return {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findByIdIncludingDisabled: vi.fn(),
    findPublicProfileById: vi.fn(),
    applyAdminMutation: vi.fn().mockResolvedValue({
      kind: 'disable',
      user: targetUser,
      changed: true,
      disable: 1,
    }),
    findAll: vi.fn().mockResolvedValue({ items: [], pagination }),
    findRecent: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    countByCreatedAtBuckets: vi.fn().mockResolvedValue({ today: 0, thisWeek: 0, thisMonth: 0 }),
    countByRole: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function createReportRepository(overrides: Partial<IReportRepository> = {}): IReportRepository {
  return {
    findById: vi.fn(),
    findAll: vi.fn().mockResolvedValue({ items: [], pagination }),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function createQuizRepository(
  overrides: Partial<IQuizRepository & IDashboardQuizRepository> = {},
): IQuizRepository & IDashboardQuizRepository {
  return {
    findById: vi.fn(),
    findAccessById: vi.fn(),
    findBySlug: vi.fn(),
    findSummaryBySlug: vi.fn(),
    findIdBySlug: vi.fn(),
    findBySourceDraftId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn().mockResolvedValue({ items: [], pagination }),
    findRecent: vi.fn().mockResolvedValue([]),
    findForPlay: vi.fn(),
    findUserQuizzes: vi.fn(),
    findPublicByAuthor: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
    countByCreatedAtBuckets: vi.fn().mockResolvedValue({ today: 0, thisWeek: 0, thisMonth: 0 }),
    findTopCreators: vi.fn().mockResolvedValue({ items: [], pagination }),
    ...overrides,
  };
}

function createAttemptRepository(overrides: Partial<IAttemptRepository> = {}): IAttemptRepository {
  return {
    findByUser: vi.fn(),
    findRecentActivity: vi.fn().mockResolvedValue([]),
    findByIdWithQuiz: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
    countByTakenAtBuckets: vi.fn().mockResolvedValue({ today: 0, thisWeek: 0, thisMonth: 0 }),
    scoreStats: vi.fn().mockResolvedValue({ averageScore: 0, highestScore: 0, lowestScore: 0 }),
    ...overrides,
  };
}

function createService(parts?: {
  user?: IUserRepository & IRecentUserRepository;
  report?: IReportRepository;
  quiz?: IQuizRepository & IDashboardQuizRepository;
  attempt?: IAttemptRepository;
}) {
  return new AdminService(
    parts?.user ?? createUserRepository(),
    parts?.report ?? createReportRepository(),
    parts?.quiz ?? createQuizRepository(),
    parts?.attempt ?? createAttemptRepository(),
  );
}

describe('AdminService mutation coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUsers', () => {
    it('forwards pagination and optional search, mapping user DTOs', async () => {
      const userRepository = createUserRepository({
        findAll: vi.fn().mockResolvedValue({
          items: [targetUser],
          pagination,
        }),
      });
      const service = createService({ user: userRepository });

      const withSearch = await service.getUsers({
        page: 2,
        limit: 10,
        search: 'learn',
        status: 'all',
      });
      expect(userRepository.findAll).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        search: 'learn',
      });
      expect(withSearch).toEqual({
        success: true,
        data: {
          users: [
            {
              id: targetUser.id,
              email: targetUser.email,
              displayName: 'Learner',
              role: 'user',
              disable: 0,
              createdAt: '2026-02-01T00:00:00.000Z',
            },
          ],
          pagination,
        },
      });

      await service.getUsers({ page: 1, limit: 20, status: 'active' });
      expect(userRepository.findAll).toHaveBeenLastCalledWith({
        page: 1,
        limit: 20,
        disable: 0,
      });
    });

    it('returns 500 when user listing fails', async () => {
      const userRepository = createUserRepository({
        findAll: vi.fn().mockRejectedValue(new Error('db down')),
      });
      const service = createService({ user: userRepository });

      await expect(service.getUsers({ page: 1, limit: 20, status: 'all' })).resolves.toEqual({
        success: false,
        error: 'Failed to get users',
        statusCode: 500,
      });
    });
  });

  describe('updateUserRole', () => {
    const actor = { id: adminUser.id, email: adminUser.email };

    it('rejects invalid roles without repository access', async () => {
      const userRepository = createUserRepository();
      const service = createService({ user: userRepository });

      await expect(
        service.updateUserRole(targetUser.id, 'moderator' as 'admin', actor),
      ).resolves.toEqual({
        success: false,
        error: 'Invalid role',
        statusCode: 400,
      });
      expect(userRepository.applyAdminMutation).not.toHaveBeenCalled();
    });

    it('maps target-not-found and last-active-admin domain errors', async () => {
      const { AdminMutationTargetNotFoundError, LastActiveAdminError } =
        await import('@/entities/AdminMutation');
      const userRepository = createUserRepository({
        applyAdminMutation: vi
          .fn()
          .mockRejectedValueOnce(new AdminMutationTargetNotFoundError())
          .mockRejectedValueOnce(new LastActiveAdminError()),
      });
      const service = createService({ user: userRepository });

      await expect(service.updateUserRole('missing', 'admin', actor)).resolves.toEqual({
        success: false,
        error: 'User not found',
        statusCode: 404,
      });

      await expect(service.updateUserRole(adminUser.id, 'user', actor)).resolves.toEqual({
        success: false,
        error: 'Cannot remove or disable the last active admin',
        statusCode: 409,
        code: 'last_active_admin',
      });
    });

    it('updates role via transactional mutation for both admin and user targets', async () => {
      const userRepository = createUserRepository({
        applyAdminMutation: vi.fn().mockResolvedValue({
          kind: 'role',
          user: targetUser,
          changed: true,
          role: 'admin',
        }),
      });
      const service = createService({ user: userRepository });

      await expect(service.updateUserRole(targetUser.id, 'admin', actor)).resolves.toEqual({
        success: true,
        data: { message: 'User role updated to admin' },
      });
      expect(userRepository.applyAdminMutation).toHaveBeenCalledWith({
        kind: 'role',
        targetUserId: targetUser.id,
        role: 'admin',
        actor,
      });

      await expect(service.updateUserRole(targetUser.id, 'user', actor)).resolves.toEqual({
        success: true,
        data: { message: 'User role updated to user' },
      });
      expect(userRepository.applyAdminMutation).toHaveBeenLastCalledWith({
        kind: 'role',
        targetUserId: targetUser.id,
        role: 'user',
        actor,
      });
    });

    it('maps admin_invariant_unavailable to 503 and actor failure to 403', async () => {
      const { AdminInvariantUnavailableError, ActorNotActiveAdminError } =
        await import('@/entities/AdminMutation');
      const userRepository = createUserRepository({
        applyAdminMutation: vi
          .fn()
          .mockRejectedValueOnce(new AdminInvariantUnavailableError())
          .mockRejectedValueOnce(new ActorNotActiveAdminError()),
      });
      const service = createService({ user: userRepository });

      await expect(service.updateUserRole(targetUser.id, 'admin', actor)).resolves.toEqual({
        success: false,
        error: 'Active-admin invariant is unavailable',
        statusCode: 503,
        code: 'admin_invariant_unavailable',
      });
      await expect(service.updateUserRole(targetUser.id, 'admin', actor)).resolves.toEqual({
        success: false,
        error: 'Actor is not an active admin',
        statusCode: 403,
      });
    });

    it('returns 500 when role update throws unexpected error', async () => {
      const userRepository = createUserRepository({
        applyAdminMutation: vi.fn().mockRejectedValue(new Error('write failed')),
      });
      const service = createService({ user: userRepository });

      await expect(service.updateUserRole(targetUser.id, 'admin', actor)).resolves.toEqual({
        success: false,
        error: 'Failed to update user role',
        statusCode: 500,
      });
    });
  });

  describe('setUserDisable', () => {
    const actor = { id: adminUser.id, email: adminUser.email };

    it('maps a missing target to 404', async () => {
      const { AdminMutationTargetNotFoundError } = await import('@/entities/AdminMutation');
      const userRepository = createUserRepository({
        applyAdminMutation: vi.fn().mockRejectedValue(new AdminMutationTargetNotFoundError()),
      });
      const service = createService({ user: userRepository });

      await expect(service.setUserDisable('507f191e810c19729de860ec', 1, actor)).resolves.toEqual({
        success: false,
        error: 'User not found',
        statusCode: 404,
      });
    });

    it('disables users on a successful changed transition', async () => {
      const disabledUser: User = {
        ...targetUser,
        disable: 1,
        disabledAt: new Date('2026-07-18T00:00:00.000Z'),
      };
      const userRepository = createUserRepository({
        applyAdminMutation: vi.fn().mockResolvedValue({
          kind: 'disable',
          user: disabledUser,
          changed: true,
          disable: 1,
        }),
      });
      const service = createService({ user: userRepository });

      await expect(service.setUserDisable(targetUser.id, 1, actor)).resolves.toMatchObject({
        success: true,
        data: {
          id: targetUser.id,
          disable: 1,
          changed: true,
        },
      });
      expect(userRepository.applyAdminMutation).toHaveBeenCalledWith({
        kind: 'disable',
        targetUserId: targetUser.id,
        disable: 1,
        actor,
        now: expect.any(Date),
      });
    });

    it('reports an idempotent already-disabled call as unchanged success', async () => {
      const disabledUser: User = { ...targetUser, disable: 1 };
      const userRepository = createUserRepository({
        applyAdminMutation: vi.fn().mockResolvedValue({
          kind: 'disable',
          user: disabledUser,
          changed: false,
          disable: 1,
        }),
      });
      const service = createService({ user: userRepository });

      await expect(service.setUserDisable(targetUser.id, 1, actor)).resolves.toMatchObject({
        success: true,
        data: { changed: false, disable: 1 },
      });
    });

    it('maps last_active_admin 409 and admin_invariant_unavailable 503', async () => {
      const { LastActiveAdminError, AdminInvariantUnavailableError } =
        await import('@/entities/AdminMutation');
      const userRepository = createUserRepository({
        applyAdminMutation: vi
          .fn()
          .mockRejectedValueOnce(new LastActiveAdminError())
          .mockRejectedValueOnce(new AdminInvariantUnavailableError()),
      });
      const service = createService({ user: userRepository });

      await expect(service.setUserDisable(targetUser.id, 1, actor)).resolves.toEqual({
        success: false,
        error: 'Cannot remove or disable the last active admin',
        statusCode: 409,
        code: 'last_active_admin',
      });
      await expect(service.setUserDisable(targetUser.id, 1, actor)).resolves.toEqual({
        success: false,
        error: 'Active-admin invariant is unavailable',
        statusCode: 503,
        code: 'admin_invariant_unavailable',
      });
    });

    it('returns 500 when applyAdminMutation throws unexpected error', async () => {
      const userRepository = createUserRepository({
        applyAdminMutation: vi.fn().mockRejectedValue(new Error('boom')),
      });
      const service = createService({ user: userRepository });

      await expect(service.setUserDisable(targetUser.id, 1, actor)).resolves.toEqual({
        success: false,
        error: 'Failed to update user status',
        statusCode: 500,
      });
    });

    it('maps AdminMutationConflictError to 409', async () => {
      const { AdminMutationConflictError } = await import('@/entities/AdminMutation');
      const userRepository = createUserRepository({
        applyAdminMutation: vi.fn().mockRejectedValue(new AdminMutationConflictError()),
      });
      const service = createService({ user: userRepository });

      await expect(service.setUserDisable(targetUser.id, 1, actor)).resolves.toEqual({
        success: false,
        error: 'Account status changed concurrently; retry',
        statusCode: 409,
      });
    });
  });

  describe('reports', () => {
    it('treats status all as undefined filter and preserves concrete statuses', async () => {
      const reportRepository = createReportRepository({
        findAll: vi.fn().mockResolvedValue({ items: [], pagination }),
      });
      const service = createService({ report: reportRepository });

      await service.getReports({ page: 1, limit: 20, status: 'all' });
      expect(reportRepository.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });

      await service.getReports({ page: 1, limit: 20, status: 'resolved' });
      expect(reportRepository.findAll).toHaveBeenLastCalledWith({
        page: 1,
        limit: 20,
        status: 'resolved',
      });
    });

    it('returns 500 when listing reports fails', async () => {
      const reportRepository = createReportRepository({
        findAll: vi.fn().mockRejectedValue(new Error('fail')),
      });
      const service = createService({ report: reportRepository });

      await expect(service.getReports({ page: 1, limit: 20, status: 'pending' })).resolves.toEqual({
        success: false,
        error: 'Failed to get reports',
        statusCode: 500,
      });
    });

    it('returns 404 when report is missing before update or when update returns null', async () => {
      const reportRepository = createReportRepository({
        findById: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'r1' }),
        update: vi.fn().mockResolvedValue(null),
      });
      const service = createService({ report: reportRepository });

      await expect(
        service.updateReportStatus('missing', { status: 'resolved' }, 'admin@example.com'),
      ).resolves.toEqual({
        success: false,
        error: 'Report not found',
        statusCode: 404,
      });

      await expect(
        service.updateReportStatus('r1', { status: 'resolved' }, 'admin@example.com'),
      ).resolves.toEqual({
        success: false,
        error: 'Report not found',
        statusCode: 404,
      });
    });

    it('sets resolution audit fields for non-pending statuses and omits optional adminNotes', async () => {
      const reportRepository = createReportRepository({
        findById: vi.fn().mockResolvedValue({ id: 'r1', status: 'pending' }),
        update: vi.fn().mockResolvedValue({ id: 'r1', status: 'dismissed' }),
      });
      const service = createService({ report: reportRepository });

      const result = await service.updateReportStatus(
        'r1',
        { status: 'dismissed' },
        'admin@example.com',
      );
      expect(result).toEqual({
        success: true,
        data: { message: 'Report marked as dismissed' },
      });
      expect(reportRepository.update).toHaveBeenCalledWith('r1', {
        status: 'dismissed',
        resolution: {
          resolvedAt: expect.any(Date),
          resolvedBy: 'admin@example.com',
        },
      });
      const updateArg = vi.mocked(reportRepository.update).mock.calls[0]?.[1] as {
        adminNotes?: string;
      };
      expect(updateArg).not.toHaveProperty('adminNotes');
    });

    it('returns 500 when updateReportStatus throws', async () => {
      const reportRepository = createReportRepository({
        findById: vi.fn().mockRejectedValue(new Error('db')),
      });
      const service = createService({ report: reportRepository });

      await expect(
        service.updateReportStatus('r1', { status: 'resolved' }, 'admin@example.com'),
      ).resolves.toEqual({
        success: false,
        error: 'Failed to update report status',
        statusCode: 500,
      });
    });

    it('deleteReport maps success, not-found, and error message extraction', async () => {
      const reportRepository = createReportRepository({
        delete: vi
          .fn()
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(false)
          .mockRejectedValueOnce(new Error('  cascade failed  ')),
      });
      const service = createService({ report: reportRepository });

      await expect(service.deleteReport('r1')).resolves.toEqual({
        success: true,
        data: { id: 'r1', deleted: true },
      });
      await expect(service.deleteReport('missing')).resolves.toEqual({
        success: false,
        error: 'Report not found',
        statusCode: 404,
      });
      await expect(service.deleteReport('r2')).resolves.toEqual({
        success: false,
        error: 'cascade failed',
        statusCode: 500,
      });
    });

    it('deleteReport falls back to default message for non-Error throws', async () => {
      const reportRepository = createReportRepository({
        delete: vi.fn().mockRejectedValue('nope'),
      });
      const service = createService({ report: reportRepository });

      await expect(service.deleteReport('r3')).resolves.toEqual({
        success: false,
        error: 'Failed to delete report',
        statusCode: 500,
      });
    });
  });

  describe('stats', () => {
    it('getStats aggregates counts and admin role bucket with zero default', async () => {
      const userRepository = createUserRepository({
        count: vi.fn().mockResolvedValue(10),
        countByRole: vi.fn().mockResolvedValue([
          { role: 'user', count: 8 },
          { role: 'admin', count: 2 },
        ]),
      });
      const quizRepository = createQuizRepository({
        count: vi.fn().mockResolvedValue(4),
      });
      const attemptRepository = createAttemptRepository({
        count: vi.fn().mockResolvedValue(7),
      });
      const service = createService({
        user: userRepository,
        quiz: quizRepository,
        attempt: attemptRepository,
      });

      await expect(service.getStats()).resolves.toEqual({
        success: true,
        data: {
          totalUsers: 10,
          totalAdmins: 2,
          totalQuizzes: 4,
          totalAttempts: 7,
        },
      });
      expect(attemptRepository.count).toHaveBeenCalledWith({});

      vi.mocked(userRepository.countByRole).mockResolvedValueOnce([{ role: 'user', count: 3 }]);
      await expect(service.getStats()).resolves.toMatchObject({
        success: true,
        data: { totalAdmins: 0 },
      });
    });

    it('getStats returns 500 on failure', async () => {
      const userRepository = createUserRepository({
        count: vi.fn().mockRejectedValue(new Error('x')),
      });
      const service = createService({ user: userRepository });

      await expect(service.getStats()).resolves.toEqual({
        success: false,
        error: 'Failed to get stats',
        statusCode: 500,
      });
    });

    it('getActivityStats uses fixed recent limits and date bucket inputs', async () => {
      const now = new Date('2026-07-16T15:30:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const userRepository = createUserRepository({
        countByCreatedAtBuckets: vi.fn().mockResolvedValue({ today: 1, thisWeek: 2, thisMonth: 3 }),
        findRecent: vi.fn().mockResolvedValue([targetUser]),
      });
      const quizRepository = createQuizRepository({
        countByCreatedAtBuckets: vi.fn().mockResolvedValue({ today: 4, thisWeek: 5, thisMonth: 6 }),
        findRecent: vi.fn().mockResolvedValue([]),
      });
      const attemptRepository = createAttemptRepository({
        countByTakenAtBuckets: vi.fn().mockResolvedValue({ today: 7, thisWeek: 8, thisMonth: 9 }),
        findRecentActivity: vi.fn().mockResolvedValue([]),
      });
      const service = createService({
        user: userRepository,
        quiz: quizRepository,
        attempt: attemptRepository,
      });

      const result = await service.getActivityStats();
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.timeBasedStats.today).toEqual({
        newUsers: 1,
        newQuizzes: 4,
        attempts: 7,
      });
      expect(userRepository.findRecent).toHaveBeenCalledWith(5);
      expect(attemptRepository.findRecentActivity).toHaveBeenCalledWith(5);
      expect(quizRepository.findRecent).toHaveBeenCalledWith(
        {},
        { limit: 5, populate: ['author'], sort: { createdAt: -1 } },
      );

      const userBucketsArg = vi.mocked(userRepository.countByCreatedAtBuckets).mock.calls[0]?.[0];
      expect(userBucketsArg?.today).toEqual(new Date(2026, 6, 16));
      expect(userBucketsArg?.thisMonth).toEqual(new Date(2026, 6, 1));
      expect(userBucketsArg?.thisWeek.getTime()).toBe(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      vi.useRealTimers();
    });

    it('getActivityStats returns 500 on failure', async () => {
      const userRepository = createUserRepository({
        countByCreatedAtBuckets: vi.fn().mockRejectedValue(new Error('x')),
      });
      const service = createService({ user: userRepository });

      await expect(service.getActivityStats()).resolves.toEqual({
        success: false,
        error: 'Failed to get activity stats',
        statusCode: 500,
      });
    });

    it('getCreatorStats maps repository results and returns 500 on failure', async () => {
      const quizRepository = createQuizRepository({
        findTopCreators: vi
          .fn()
          .mockResolvedValueOnce({
            items: [
              {
                id: targetUser.id,
                email: targetUser.email,
                role: 'user',
                joinedAt: new Date('2026-06-01T00:00:00.000Z'),
                quizCount: 2,
                totalQuestions: 20,
              },
            ],
            pagination,
          })
          .mockRejectedValueOnce(new Error('fail')),
      });
      const service = createService({ quiz: quizRepository });

      await expect(service.getCreatorStats({ page: 1, limit: 10 })).resolves.toEqual({
        success: true,
        data: {
          creators: [
            {
              id: targetUser.id,
              email: targetUser.email,
              quizCount: 2,
              totalQuestions: 20,
              joinedAt: '2026-06-01T00:00:00.000Z',
              role: 'user',
            },
          ],
          pagination,
        },
      });
      expect(quizRepository.findTopCreators).toHaveBeenCalledWith({ page: 1, limit: 10 });

      await expect(service.getCreatorStats({ page: 1, limit: 10 })).resolves.toEqual({
        success: false,
        error: 'Failed to get creator stats',
        statusCode: 500,
      });
    });

    it('getScoreStats rounds average and returns 500 on failure', async () => {
      const attemptRepository = createAttemptRepository({
        scoreStats: vi
          .fn()
          .mockResolvedValueOnce({ averageScore: 87.4, highestScore: 100, lowestScore: 10 })
          .mockRejectedValueOnce(new Error('x')),
      });
      const service = createService({ attempt: attemptRepository });

      await expect(service.getScoreStats()).resolves.toEqual({
        success: true,
        data: {
          averageScore: 87,
          highestScore: 100,
          lowestScore: 10,
          passRate: 0,
          scoreDistribution: [],
        },
      });
      await expect(service.getScoreStats()).resolves.toEqual({
        success: false,
        error: 'Failed to get score stats',
        statusCode: 500,
      });
    });
  });
});
