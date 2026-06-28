import {
  IAdminService,
  type AdminActivityStats,
  type AdminCreatorStat,
  type AdminMessageResult,
  type AdminPaginatedUsers,
  type AdminReportItem,
  type AdminStats,
  type SearchParams,
} from '@/interfaces/services/IAdminService';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { IReportRepository } from '@/interfaces/repositories/IReportRepository';
import { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import { IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository';
import { ServiceResult } from '@/interfaces/services/types';
import { logger } from '@/lib/logger';
import { normalizeAdminRecentAttempt } from '@/services/admin/adminActivity';

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export class AdminService implements IAdminService {
  constructor(
    private userRepository: IUserRepository,
    private reportRepository: IReportRepository,
    private quizRepository: IQuizRepository,
    private attemptRepository: IAttemptRepository,
  ) {}

  async getUsers(searchParams: SearchParams): Promise<ServiceResult<AdminPaginatedUsers>> {
    try {
      const { search, page = 1, limit = 10 } = searchParams;

      const result = await this.userRepository.findAll({
        page,
        limit,
        search,
      });

      return {
        success: true,
        data: result as unknown as AdminPaginatedUsers,
      };
    } catch (error) {
      logger.error({ error }, 'Get users error');
      return {
        success: false,
        error: 'Failed to get users',
        statusCode: 500,
      };
    }
  }

  async updateUserRole(
    userId: string,
    role: string,
    adminEmail: string,
  ): Promise<ServiceResult<AdminMessageResult>> {
    try {
      if (role !== 'admin' && role !== 'user') {
        return {
          success: false,
          error: 'Invalid role',
          statusCode: 400,
        };
      }

      const user = await this.userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
          statusCode: 404,
        };
      }

      if (user.email === adminEmail) {
        return {
          success: false,
          error: 'Cannot change your own role',
          statusCode: 400,
        };
      }

      await this.userRepository.update(userId, { role });

      return {
        success: true,
        data: { message: `User role updated to ${role}` },
      };
    } catch (error) {
      logger.error({ error }, 'Update user role error');
      return {
        success: false,
        error: 'Failed to update user role',
        statusCode: 500,
      };
    }
  }

  async deleteUser(userId: string, adminEmail: string): Promise<ServiceResult<boolean>> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
          statusCode: 404,
        };
      }

      if (user.email === adminEmail) {
        return {
          success: false,
          error: 'Cannot delete your own account',
          statusCode: 400,
        };
      }

      const deleted = await this.userRepository.delete(userId);

      return {
        success: true,
        data: deleted,
      };
    } catch (error) {
      logger.error({ error }, 'Delete user error');
      return {
        success: false,
        error: 'Failed to delete user',
        statusCode: 500,
      };
    }
  }

  async getReports(_searchParams: SearchParams): Promise<ServiceResult<AdminReportItem[]>> {
    try {
      // Implement reports logic if needed
      return {
        success: true,
        data: [],
      };
    } catch (_error) {
      return {
        success: false,
        error: 'Failed to get reports',
        statusCode: 500,
      };
    }
  }

  async updateReportStatus(
    _reportId: string,
    _status: string,
  ): Promise<ServiceResult<AdminMessageResult>> {
    try {
      // Implement report status update logic if needed
      return {
        success: true,
        data: { message: 'Report status updated' },
      };
    } catch (_error) {
      return {
        success: false,
        error: 'Failed to update report status',
        statusCode: 500,
      };
    }
  }

  async getStats(): Promise<ServiceResult<AdminStats>> {
    try {
      const [totalUsers, roleStats, totalQuizzes, totalAttempts] = await Promise.all([
        this.userRepository.count(),
        this.userRepository.countByRole(),
        this.quizRepository.count(),
        this.attemptRepository.count({}),
      ]);

      const totalAdmins = roleStats.find((r) => r._id === 'admin')?.count || 0;

      return {
        success: true,
        data: {
          totalUsers,
          totalAdmins,
          totalQuizzes,
          totalAttempts,
        },
      };
    } catch (error) {
      logger.error({ error }, 'getStats error');
      return {
        success: false,
        error: 'Failed to get stats',
        statusCode: 500,
      };
    }
  }

  async getActivityStats(): Promise<ServiceResult<AdminActivityStats>> {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        newUsersToday,
        newQuizzesToday,
        attemptsToday,
        newUsersWeek,
        newQuizzesWeek,
        attemptsWeek,
        newUsersMonth,
        newQuizzesMonth,
        attemptsMonth,
        recentUsers,
        recentQuizzes,
        recentAttempts,
      ] = await Promise.all([
        this.userRepository.count({ createdAt: { $gte: today } }),
        this.quizRepository.count({ createdAt: { $gte: today } }),
        this.attemptRepository.count({ takenAt: { $gte: today } }),
        this.userRepository.count({ createdAt: { $gte: thisWeek } }),
        this.quizRepository.count({ createdAt: { $gte: thisWeek } }),
        this.attemptRepository.count({ takenAt: { $gte: thisWeek } }),
        this.userRepository.count({ createdAt: { $gte: thisMonth } }),
        this.quizRepository.count({ createdAt: { $gte: thisMonth } }),
        this.attemptRepository.count({ takenAt: { $gte: thisMonth } }),
        this.userRepository.findAll({ limit: 5 }),
        this.quizRepository.findAll({}, { limit: 5, populate: ['author'] }),
        this.attemptRepository.findRecentActivity(5),
      ]);

      return {
        success: true,
        data: {
          timeBasedStats: {
            today: {
              newUsers: newUsersToday,
              newQuizzes: newQuizzesToday,
              attempts: attemptsToday,
            },
            thisWeek: {
              newUsers: newUsersWeek,
              newQuizzes: newQuizzesWeek,
              attempts: attemptsWeek,
            },
            thisMonth: {
              newUsers: newUsersMonth,
              newQuizzes: newQuizzesMonth,
              attempts: attemptsMonth,
            },
          },
          recentActivity: {
            users: recentUsers.users.map((u) => ({
              email: (u as { email: string }).email,
              createdAt: (u as { createdAt?: Date }).createdAt,
            })),
            quizzes: recentQuizzes.quizzes,
            attempts: recentAttempts.map(normalizeAdminRecentAttempt),
          },
        },
      };
    } catch (error) {
      logger.error({ error }, 'getActivityStats error');
      return {
        success: false,
        error: 'Failed to get activity stats',
        statusCode: 500,
      };
    }
  }

  async getCreatorStats(): Promise<ServiceResult<AdminCreatorStat[]>> {
    try {
      // Implement creator stats if needed
      return {
        success: true,
        data: [],
      };
    } catch (_error) {
      return {
        success: false,
        error: 'Failed to get creator stats',
        statusCode: 500,
      };
    }
  }

  async deleteReport(reportId: string): Promise<ServiceResult<boolean>> {
    try {
      const deleted = await this.reportRepository.delete(reportId);
      if (!deleted) {
        return { success: false, error: 'Report not found', statusCode: 404 };
      }
      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        error: toMessage(error, 'Failed to delete report'),
        statusCode: 500,
      };
    }
  }
}
