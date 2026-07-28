import { IAdminService } from '@/interfaces/services/IAdminService';
import type {
  AdminActivityStatsDto,
  AdminCreatorStatsListDto,
  AdminGrowthTrendsDto,
  AdminGrowthPeriodDto,
  AdminOverviewStatsDto,
  AdminScoreStatsDto,
  AdminStatsListQueryDto,
} from '@/dtos/admin-stats';
import type {
  AdminReportListDto,
  AdminReportListQueryDto,
  AdminReportedQuestionDto,
  UpdateAdminReportRequestDto,
  UpdateAdminReportedQuestionRequestDto,
} from '@/dtos/admin-report';
import type {
  AdminMessageDto,
  AdminUserListDto,
  AdminUserListQueryDto,
  AdminUserStatusDto,
  UpdateAdminUserRoleRequestDto,
  UpdateAdminUserStatusRequestDto,
} from '@/dtos/admin-user';
import type { DeleteResultDto } from '@/dtos/common';
import type { QuizQuestion } from '@/entities/Quiz';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { IReportRepository } from '@/interfaces/repositories/IReportRepository';
import { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { IDashboardQuizRepository } from '@/interfaces/repositories/IDashboardQuizRepository';
import type { IRecentUserRepository } from '@/interfaces/repositories/IRecentUserRepository';
import { IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository';
import type { IAdminStatsRepository } from '@/interfaces/repositories/IAdminStatsRepository';
import { ServiceResult } from '@/interfaces/services/types';
import { logger } from '@/lib/logger';
import { invalidateEntitlements } from '@/lib/entitlements/cache';
import { AdminUserDtoMapper } from '@/mappers/admin/AdminUserDtoMapper';
import { AdminReportDtoMapper } from '@/mappers/admin/AdminReportDtoMapper';
import { AdminMessageDtoMapper } from '@/mappers/admin/AdminMessageDtoMapper';
import { AdminStatsDtoMapper } from '@/mappers/admin/AdminStatsDtoMapper';
import { DeleteResultDtoMapper } from '@/mappers/common/DeleteResultDtoMapper';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import {
  ActorNotActiveAdminError,
  AdminInvariantUnavailableError,
  AdminMutationConflictError,
  AdminMutationTargetNotFoundError,
  LastActiveAdminError,
  type AdminMutationActor,
} from '@/entities/AdminMutation';
import {
  ACCOUNT_DISABLE_ACTIVE,
  ACCOUNT_DISABLE_DISABLED,
  type AccountDisableState,
} from '@/shared/constants/account-disable';
import { ADMIN_INVARIANT_ERROR_CODE } from '@/shared/constants/admin-invariant';

type ReportedQuestionContextResult =
  | {
      success: true;
      quizId: string;
      questionId: string;
      questionIndex: number;
      question: QuizQuestion;
    }
  | { success: false; error: string; statusCode: number };

export class AdminService implements IAdminService {
  constructor(
    private userRepository: IUserRepository & IRecentUserRepository,
    private reportRepository: IReportRepository,
    private quizRepository: IQuizRepository & IDashboardQuizRepository,
    private attemptRepository: IAttemptRepository,
    private adminStatsRepository?: IAdminStatsRepository,
  ) {}

  private mapListStatusFilter(
    status: AdminUserListQueryDto['status'],
  ): AccountDisableState | undefined {
    if (status === 'active') return ACCOUNT_DISABLE_ACTIVE;
    if (status === 'disabled') return ACCOUNT_DISABLE_DISABLED;
    return undefined;
  }

  private mapAdminMutationFailure(error: unknown, fallbackMessage: string): ServiceResult<never> {
    if (error instanceof LastActiveAdminError) {
      return {
        success: false,
        error: error.message,
        statusCode: 409,
        code: ADMIN_INVARIANT_ERROR_CODE.LAST_ACTIVE_ADMIN,
      };
    }
    if (error instanceof AdminInvariantUnavailableError) {
      logger.error(
        { error, cause: error.cause },
        'Active-admin invariant unavailable during admin mutation',
      );
      return {
        success: false,
        error: 'Active-admin invariant is unavailable',
        statusCode: 503,
        code: ADMIN_INVARIANT_ERROR_CODE.ADMIN_INVARIANT_UNAVAILABLE,
      };
    }
    if (error instanceof ActorNotActiveAdminError) {
      return {
        success: false,
        error: error.message,
        statusCode: 403,
      };
    }
    if (error instanceof AdminMutationTargetNotFoundError) {
      return {
        success: false,
        error: 'User not found',
        statusCode: 404,
      };
    }
    if (error instanceof AdminMutationConflictError) {
      return {
        success: false,
        error: 'Account status changed concurrently; retry',
        statusCode: 409,
      };
    }
    logger.error({ error }, fallbackMessage);
    return {
      success: false,
      error: fallbackMessage,
      statusCode: 500,
    };
  }

  async getUsers(searchParams: AdminUserListQueryDto): Promise<ServiceResult<AdminUserListDto>> {
    try {
      const { search, page, limit, role, status } = searchParams;
      const disable = this.mapListStatusFilter(status);

      const result = await this.userRepository.findAll({
        page,
        limit,
        ...(search !== undefined && { search }),
        ...(role !== undefined && { role }),
        ...(disable !== undefined && { disable }),
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
    actor: AdminMutationActor,
  ): Promise<ServiceResult<AdminMessageDto>> {
    try {
      if (role !== 'admin' && role !== 'user') {
        return {
          success: false,
          error: 'Invalid role',
          statusCode: 400,
        };
      }

      // Authorization is transaction-authoritative (actor re-read inside mutation).
      await this.userRepository.applyAdminMutation({
        kind: 'role',
        targetUserId: userId,
        role,
        actor,
      });

      return {
        success: true,
        data: AdminMessageDtoMapper.toDto(`User role updated to ${role}`),
      };
    } catch (error) {
      return this.mapAdminMutationFailure(error, 'Failed to update user role');
    }
  }

  async setUserDisable(
    userId: string,
    disable: UpdateAdminUserStatusRequestDto['disable'],
    actor: AdminMutationActor,
  ): Promise<ServiceResult<AdminUserStatusDto>> {
    try {
      // Authorization is transaction-authoritative (actor re-read inside mutation).
      // Self-mutation is allowed only when the last-active-admin invariant still holds.
      const transition = await this.userRepository.applyAdminMutation({
        kind: 'disable',
        targetUserId: userId,
        disable,
        actor,
        now: new Date(),
      });

      if (transition.kind !== 'disable') {
        return {
          success: false,
          error: 'Failed to update user status',
          statusCode: 500,
        };
      }

      // Reconcile local cache after both changed and idempotent success. A client
      // may be retrying after an ambiguous commit result from another instance.
      invalidateEntitlements(userId);

      return {
        success: true,
        data: AdminUserDtoMapper.toStatusDto(transition.user, transition.changed, disable),
      };
    } catch (error) {
      return this.mapAdminMutationFailure(error, 'Failed to update user status');
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

  async getReportedQuestion(reportId: string): Promise<ServiceResult<AdminReportedQuestionDto>> {
    try {
      const context = await this.getReportedQuestionContext(reportId);
      if (!context.success) return context;

      return {
        success: true,
        data: AdminReportDtoMapper.toQuestionDto(context.question, context.questionIndex),
      };
    } catch (error) {
      logger.error({ error }, 'Get reported question error');
      return {
        success: false,
        error: 'Failed to get reported question',
        statusCode: 500,
      };
    }
  }

  async updateReportedQuestion(
    reportId: string,
    input: UpdateAdminReportedQuestionRequestDto,
  ): Promise<ServiceResult<AdminReportedQuestionDto>> {
    try {
      const context = await this.getReportedQuestionContext(reportId);
      if (!context.success) return context;

      const question =
        input.type === 'single'
          ? {
              question: input.question,
              options: input.options,
              type: 'single' as const,
              correctIndex: input.correctIndex,
              ...(input.questionImage !== undefined ? { questionImage: input.questionImage } : {}),
              ...(input.optionImages !== undefined ? { optionImages: input.optionImages } : {}),
            }
          : {
              question: input.question,
              options: input.options,
              type: 'multiple' as const,
              correctIndexes: input.correctIndexes,
              ...(input.questionImage !== undefined ? { questionImage: input.questionImage } : {}),
              ...(input.optionImages !== undefined ? { optionImages: input.optionImages } : {}),
            };

      const updateQuestionById = this.quizRepository.updateQuestionById;
      if (!updateQuestionById) {
        return {
          success: false,
          error: 'Question editing is temporarily unavailable',
          statusCode: 503,
        };
      }

      const updated = await updateQuestionById.call(
        this.quizRepository,
        context.quizId,
        context.questionId,
        question,
      );
      if (!updated) {
        return {
          success: false,
          error: 'The reported question changed or no longer exists',
          statusCode: 409,
        };
      }

      return {
        success: true,
        data: AdminReportDtoMapper.toQuestionDto(
          { id: context.questionId, ...question },
          context.questionIndex,
        ),
      };
    } catch (error) {
      logger.error({ error }, 'Update reported question error');
      return {
        success: false,
        error: 'Failed to update reported question',
        statusCode: 500,
      };
    }
  }

  private async getReportedQuestionContext(
    reportId: string,
  ): Promise<ReportedQuestionContextResult> {
    const report = await this.reportRepository.findById(reportId);
    if (!report) {
      return { success: false, error: 'Report not found', statusCode: 404 };
    }
    if (!report.questionId) {
      return {
        success: false,
        error: 'This legacy report is not linked to a specific question',
        statusCode: 409,
      };
    }

    const quiz = await this.quizRepository.findById(report.quizId);
    if (!quiz) {
      return { success: false, error: 'Quiz not found', statusCode: 404 };
    }

    const questionIndex = quiz.questions.findIndex((question) => question.id === report.questionId);
    const question = quiz.questions[questionIndex];
    if (questionIndex < 0 || !question) {
      return {
        success: false,
        error: 'The reported question no longer exists',
        statusCode: 409,
      };
    }

    return {
      success: true,
      quizId: report.quizId,
      questionId: report.questionId,
      questionIndex,
      question,
    };
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

  async getCreatorStats(
    query: AdminStatsListQueryDto,
  ): Promise<ServiceResult<AdminCreatorStatsListDto>> {
    try {
      const creators = await this.quizRepository.findTopCreators(query);

      return {
        success: true,
        data: AdminStatsDtoMapper.toCreatorListDto(creators),
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
      const [stats, distribution] = await Promise.all([
        this.attemptRepository.scoreStats(),
        this.adminStatsRepository?.getScoreDistribution() ?? Promise.resolve([]),
      ]);
      return {
        success: true,
        data: AdminStatsDtoMapper.toScoreStatsDto(stats, distribution),
      };
    } catch (error) {
      logger.error({ error }, 'Get score stats error');
      return { success: false, error: 'Failed to get score stats', statusCode: 500 };
    }
  }

  async getGrowthTrends(days: AdminGrowthPeriodDto): Promise<ServiceResult<AdminGrowthTrendsDto>> {
    try {
      if (!this.adminStatsRepository) {
        return {
          success: false,
          error: 'Statistics analytics are unavailable',
          statusCode: 503,
        };
      }
      const now = new Date();
      const todayUtc = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const since = new Date(todayUtc.getTime() - (days * 2 - 1) * 86_400_000);
      const activity = await this.adminStatsRepository.getDailyActivity(since);

      return {
        success: true,
        data: AdminStatsDtoMapper.toGrowthTrendsDto(activity, days, now),
      };
    } catch (error) {
      logger.error({ error }, 'Get growth trends error');
      return { success: false, error: 'Failed to get growth trends', statusCode: 500 };
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
