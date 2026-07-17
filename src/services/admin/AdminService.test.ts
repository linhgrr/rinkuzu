import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminService } from '@/services/admin/AdminService';
import type { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import type { IReportRepository } from '@/interfaces/repositories/IReportRepository';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository';
import type { IRecentUserRepository } from '@/interfaces/repositories/IRecentUserRepository';
import type { IDashboardQuizRepository } from '@/interfaces/repositories/IDashboardQuizRepository';

const pagination = {
  currentPage: 1,
  totalPages: 1,
  totalItems: 1,
  itemsPerPage: 20,
  hasNextPage: false,
  hasPrevPage: false,
};

function createUserRepository(): IUserRepository & IRecentUserRepository {
  return {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findSubscriptionById: vi.fn(),
    findPublicProfileById: vi.fn(),
    updateRole: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn().mockResolvedValue({ items: [], pagination }),
    findRecent: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    countByCreatedAtBuckets: vi.fn().mockResolvedValue({ today: 0, thisWeek: 0, thisMonth: 0 }),
    countByRole: vi.fn().mockResolvedValue([]),
  };
}

function createReportRepository(overrides: Partial<IReportRepository> = {}): IReportRepository {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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

function createAttemptRepository(): IAttemptRepository {
  return {
    findByUser: vi.fn(),
    findRecentActivity: vi.fn().mockResolvedValue([]),
    findByIdWithQuiz: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
    countByTakenAtBuckets: vi.fn().mockResolvedValue({ today: 0, thisWeek: 0, thisMonth: 0 }),
    scoreStats: vi.fn().mockResolvedValue({ averageScore: 0, highestScore: 0, lowestScore: 0 }),
  };
}

describe('AdminService report and stats contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists report DTOs through the report repository', async () => {
    const reportRepository = createReportRepository({
      findAll: vi.fn().mockResolvedValue({
        items: [
          {
            id: '507f191e810c19729de860ea',
            quizId: '507f191e810c19729de860eb',
            quizTitle: 'Algebra',
            quizSlug: 'algebra',
            reporterEmail: 'learner@example.com',
            reporterName: 'Learner',
            content: 'Wrong answer',
            status: 'pending',
            createdAt: new Date('2026-07-01T00:00:00Z'),
            updatedAt: new Date('2026-07-01T00:00:00Z'),
          },
        ],
        pagination,
      }),
    });
    const service = new AdminService(
      createUserRepository(),
      reportRepository,
      createQuizRepository(),
      createAttemptRepository(),
    );

    const result = await service.getReports({ page: 1, limit: 20, status: 'pending' });

    expect(reportRepository.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: 'pending',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.reports[0]).toMatchObject({
      id: '507f191e810c19729de860ea',
      quizId: '507f191e810c19729de860eb',
      createdAt: '2026-07-01T00:00:00.000Z',
    });
  });

  it('updates report status with admin audit fields', async () => {
    const reportRepository = createReportRepository({
      findById: vi.fn().mockResolvedValue({
        id: '507f191e810c19729de860ea',
        quizId: '507f191e810c19729de860eb',
        quizTitle: 'Algebra',
        quizSlug: 'algebra',
        reporterEmail: 'learner@example.com',
        reporterName: 'Learner',
        content: 'Wrong answer',
        status: 'pending',
        createdAt: new Date('2026-07-01T00:00:00Z'),
        updatedAt: new Date('2026-07-01T00:00:00Z'),
      }),
      update: vi.fn().mockResolvedValue({
        id: '507f191e810c19729de860ea',
        status: 'resolved',
      }),
    });
    const service = new AdminService(
      createUserRepository(),
      reportRepository,
      createQuizRepository(),
      createAttemptRepository(),
    );

    const result = await service.updateReportStatus(
      '507f191e810c19729de860ea',
      { status: 'resolved', adminNotes: 'fixed' },
      'admin@example.com',
    );

    expect(result).toEqual({ success: true, data: { message: 'Report marked as resolved' } });
    expect(reportRepository.update).toHaveBeenCalledWith('507f191e810c19729de860ea', {
      status: 'resolved',
      adminNotes: 'fixed',
      resolution: {
        resolvedAt: expect.any(Date),
        resolvedBy: 'admin@example.com',
      },
    });
  });

  it('explicitly clears resolution audit fields when reopening a report', async () => {
    const reportRepository = createReportRepository({
      findById: vi.fn().mockResolvedValue({ id: 'report-1', status: 'resolved' }),
      update: vi.fn().mockResolvedValue({ id: 'report-1', status: 'pending' }),
    });
    const service = new AdminService(
      createUserRepository(),
      reportRepository,
      createQuizRepository(),
      createAttemptRepository(),
    );

    await service.updateReportStatus('report-1', { status: 'pending' }, 'admin@example.com');

    expect(reportRepository.update).toHaveBeenCalledWith('report-1', {
      status: 'pending',
      resolution: null,
    });
  });

  it('maps top creator aggregate records to creator DTOs', async () => {
    const quizRepository = createQuizRepository({
      findTopCreators: vi.fn().mockResolvedValue({
        items: [
          {
            id: '507f191e810c19729de860eb',
            email: 'teacher@example.com',
            role: 'user',
            joinedAt: new Date('2026-06-01T00:00:00Z'),
            quizCount: 3,
            totalQuestions: 30,
          },
        ],
        pagination: { ...pagination, currentPage: 2, itemsPerPage: 5 },
      }),
    });
    const service = new AdminService(
      createUserRepository(),
      createReportRepository(),
      quizRepository,
      createAttemptRepository(),
    );

    const result = await service.getCreatorStats({ page: 2, limit: 5 });

    expect(quizRepository.findTopCreators).toHaveBeenCalledWith({ page: 2, limit: 5 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      creators: [
        {
          id: '507f191e810c19729de860eb',
          email: 'teacher@example.com',
          quizCount: 3,
          totalQuestions: 30,
          joinedAt: '2026-06-01T00:00:00.000Z',
          role: 'user',
        },
      ],
      pagination: { ...pagination, currentPage: 2, itemsPerPage: 5 },
    });
  });

  it('loads activity stats from repository bucket counts', async () => {
    const userRepository = createUserRepository();
    const quizRepository = createQuizRepository();
    const attemptRepository = createAttemptRepository();
    vi.mocked(userRepository.countByCreatedAtBuckets).mockResolvedValue({
      today: 1,
      thisWeek: 2,
      thisMonth: 3,
    });
    vi.mocked(quizRepository.countByCreatedAtBuckets).mockResolvedValue({
      today: 4,
      thisWeek: 5,
      thisMonth: 6,
    });
    vi.mocked(attemptRepository.countByTakenAtBuckets).mockResolvedValue({
      today: 7,
      thisWeek: 8,
      thisMonth: 9,
    });

    const service = new AdminService(
      userRepository,
      createReportRepository(),
      quizRepository,
      attemptRepository,
    );

    const result = await service.getActivityStats();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.timeBasedStats).toEqual({
      today: { newUsers: 1, newQuizzes: 4, attempts: 7 },
      thisWeek: { newUsers: 2, newQuizzes: 5, attempts: 8 },
      thisMonth: { newUsers: 3, newQuizzes: 6, attempts: 9 },
    });
    expect(userRepository.count).not.toHaveBeenCalled();
    expect(quizRepository.count).not.toHaveBeenCalled();
    expect(attemptRepository.count).not.toHaveBeenCalled();
    expect(userRepository.findRecent).toHaveBeenCalledWith(5);
    expect(userRepository.findAll).not.toHaveBeenCalled();
    expect(quizRepository.findRecent).toHaveBeenCalledWith(
      {},
      { limit: 5, populate: ['author'], sort: { createdAt: -1 } },
    );
    expect(quizRepository.findAll).not.toHaveBeenCalled();
  });
});
