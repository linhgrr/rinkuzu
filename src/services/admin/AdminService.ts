import { IAdminService } from '@/interfaces/services/IAdminService';
import type {
  AdminMessageDto,
  AdminUserListDto,
  AdminUserListQueryDto,
  UpdateAdminUserRoleRequestDto,
} from '@/dtos/admin-user';
import type {
  AdminReportListDto,
  AdminReportListQueryDto,
  UpdateAdminReportRequestDto,
} from '@/dtos/admin-report';
import type {
  AdminActivityStatsDto,
  AdminCreatorStatDto,
  AdminOverviewStatsDto,
  AdminScoreStatsDto,
} from '@/dtos/admin-stats';
import type { DeleteResultDto } from '@/dtos/common';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { IReportRepository } from '@/interfaces/repositories/IReportRepository';
import { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { IDashboardQuizRepository } from '@/interfaces/repositories/IDashboardQuizRepository';
import type { IRecentUserRepository } from '@/interfaces/repositories/IRecentUserRepository';
import { IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository';
import { ServiceResult } from '@/interfaces/services/types';
import { logger } from '@/lib/logger';
import { AdminUserDtoMapper } from '@/mappers/admin/AdminUserDtoMapper';
import { AdminReportDtoMapper } from '@/mappers/admin/AdminReportDtoMapper';
import { AdminMessageDtoMapper } from '@/mappers/admin/AdminMessageDtoMapper';
import { AdminStatsDtoMapper } from '@/mappers/admin/AdminStatsDtoMapper';
import { DeleteResultDtoMapper } from '@/mappers/common/DeleteResultDtoMapper';
import { extractUnknownErrorMessage } from '@/lib/api/error';

export class AdminService implements IAdminService {
  constructor(
    private userRepository: IUserRepository & IRecentUserRepository,
    private reportRepository: IReportRepository,
    private quizRepository: IQuizRepository & IDashboardQuizRepository,
    private attemptRepository: IAttemptRepository,
  ) {}

  async getUsers(searchParams: AdminUserListQueryDto): Promise<ServiceResult<AdminUserListDto>> {
    try {
      const { search, page, limit } = searchParams;

      const result = await this.userRepository.findAll({
        page,
        limit,
        ...(search !== undefined && { search }),
      });

      return {
        success: true,
        data: AdminUserDtoMapper.toListDto(result.items, result.pagination),
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
    role: UpdateAdminUserRoleRequestDto['role'],
    adminEmail: string,
  ): Promise<ServiceResult<AdminMessageDto>> {
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

      await this.userRepository.updateRole(userId, role);

      return {
        success: true,
        data: AdminMessageDtoMapper.toDto(`User role updated to ${role}`),
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

  async deleteUser(userId: string, adminEmail: string): Promise<ServiceResult<DeleteResultDto>> {
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
      if (!deleted) {
        return { success: false, error: 'User not found', statusCode: 404 };
      }

      return {
        success: true,
        data: DeleteResultDtoMapper.toDto(userId),
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

  async getReports(
    searchParams: AdminReportListQueryDto,
  ): Promise<ServiceResult<AdminReportListDto>> {
    try {
      const status = searchParams.status === 'all' ? undefined : searchParams.status;
      const result = await this.reportRepository.findAll({
        page: searchParams.page,
        limit: searchParams.limit,
        ...(status !== undefined && { status }),
      });

      return {
        success: true,
        data: AdminReportDtoMapper.toListDto(result.items, result.pagination),
      };
    } catch (error) {
      logger.error({ error }, 'Get reports error');
      return {
        success: false,
        error: 'Failed to get reports',
        statusCode: 500,
      };
    }
  }

  async updateReportStatus(
    reportId: string,
    input: UpdateAdminReportRequestDto,
    adminEmail: string,
  ): Promise<ServiceResult<AdminMessageDto>> {
    try {
      const existing = await this.reportRepository.findById(reportId);
      if (!existing) {
        return {
          success: false,
          error: 'Report not found',
          statusCode: 404,
        };
      }

      const updated = await this.reportRepository.update(reportId, {
        status: input.status,
        resolution:
          input.status === 'pending' ? null : { resolvedAt: new Date(), resolvedBy: adminEmail },
        ...(input.adminNotes !== undefined && { adminNotes: input.adminNotes }),
      });

      if (!updated) {
        return {
          success: false,
          error: 'Report not found',
          statusCode: 404,
        };
      }

      return {
        success: true,
        data: AdminMessageDtoMapper.toDto(`Report marked as ${input.status}`),
      };
    } catch (error) {
      logger.error({ error }, 'Update report status error');
      return {
        success: false,
        error: 'Failed to update report status',
        statusCode: 500,
      };
    }
  }

  async getStats(): Promise<ServiceResult<AdminOverviewStatsDto>> {
    try {
      const [totalUsers, roleStats, totalQuizzes, totalAttempts] = await Promise.all([
        this.userRepository.count(),
        this.userRepository.countByRole(),
        this.quizRepository.count(),
        this.attemptRepository.count({}),
      ]);

      const totalAdmins = roleStats.find((roleCount) => roleCount.role === 'admin')?.count ?? 0;

      return {
        success: true,
        data: AdminStatsDtoMapper.toOverviewDto(
          totalUsers,
          totalAdmins,
          totalQuizzes,
          totalAttempts,
        ),
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

  async getActivityStats(): Promise<ServiceResult<AdminActivityStatsDto>> {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [userBuckets, quizBuckets, attemptBuckets, recentUsers, recentQuizzes, recentAttempts] =
        await Promise.all([
          this.userRepository.countByCreatedAtBuckets({ today, thisWeek, thisMonth }),
          this.quizRepository.countByCreatedAtBuckets({ today, thisWeek, thisMonth }),
          this.attemptRepository.countByTakenAtBuckets({ today, thisWeek, thisMonth }),
          this.userRepository.findRecent(5),
          this.quizRepository.findRecent(
            {},
            { limit: 5, populate: ['author'], sort: { createdAt: -1 } },
          ),
          this.attemptRepository.findRecentActivity(5),
        ]);

      return {
        success: true,
        data: AdminStatsDtoMapper.toActivityDto(
          userBuckets,
          quizBuckets,
          attemptBuckets,
          recentUsers,
          recentQuizzes,
          recentAttempts,
        ),
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

  async getCreatorStats(limit: number): Promise<ServiceResult<AdminCreatorStatDto[]>> {
    try {
      const creators = await this.quizRepository.findTopCreators(limit);

      return {
        success: true,
        data: creators.map(AdminStatsDtoMapper.toCreatorDto),
      };
    } catch (error) {
      logger.error({ error }, 'Get creator stats error');
      return {
        success: false,
        error: 'Failed to get creator stats',
        statusCode: 500,
      };
    }
  }

  async getScoreStats(): Promise<ServiceResult<AdminScoreStatsDto>> {
    try {
      const stats = await this.attemptRepository.scoreStats();
      return { success: true, data: AdminStatsDtoMapper.toScoreStatsDto(stats) };
    } catch (error) {
      logger.error({ error }, 'Get score stats error');
      return { success: false, error: 'Failed to get score stats', statusCode: 500 };
    }
  }

  async deleteReport(reportId: string): Promise<ServiceResult<DeleteResultDto>> {
    try {
      const deleted = await this.reportRepository.delete(reportId);
      if (!deleted) {
        return { success: false, error: 'Report not found', statusCode: 404 };
      }
      return { success: true, data: DeleteResultDtoMapper.toDto(reportId) };
    } catch (error) {
      return {
        success: false,
        error: extractUnknownErrorMessage(error, 'Failed to delete report'),
        statusCode: 500,
      };
    }
  }
}
