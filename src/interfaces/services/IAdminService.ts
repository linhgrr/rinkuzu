import { ServiceResult } from '@/interfaces/services/types';
import type { DeleteResultDto } from '@/dtos/common';
import type {
  AdminMessageDto,
  AdminUserListDto,
  AdminUserListQueryDto,
  AdminUserStatusDto,
  UpdateAdminUserRoleRequestDto,
  UpdateAdminUserStatusRequestDto,
} from '@/dtos/admin-user';
import type {
  AdminReportListDto,
  AdminReportListQueryDto,
  UpdateAdminReportRequestDto,
} from '@/dtos/admin-report';
import type {
  AdminActivityStatsDto,
  AdminCreatorStatsListDto,
  AdminOverviewStatsDto,
  AdminStatsListQueryDto,
} from '@/dtos/admin-stats';
import type { AdminMutationActor } from '@/entities/AdminMutation';

export interface IAdminService {
  // User management
  getUsers(searchParams: AdminUserListQueryDto): Promise<ServiceResult<AdminUserListDto>>;
  updateUserRole(
    userId: string,
    role: UpdateAdminUserRoleRequestDto['role'],
    actor: AdminMutationActor,
  ): Promise<ServiceResult<AdminMessageDto>>;
  setUserDisable(
    userId: string,
    disable: UpdateAdminUserStatusRequestDto['disable'],
    actor: AdminMutationActor,
  ): Promise<ServiceResult<AdminUserStatusDto>>;

  // Reports management
  getReports(searchParams: AdminReportListQueryDto): Promise<ServiceResult<AdminReportListDto>>;
  updateReportStatus(
    reportId: string,
    input: UpdateAdminReportRequestDto,
    adminEmail: string,
  ): Promise<ServiceResult<AdminMessageDto>>;
  deleteReport(reportId: string): Promise<ServiceResult<DeleteResultDto>>;

  // Statistics
  getStats(): Promise<ServiceResult<AdminOverviewStatsDto>>;
  getActivityStats(): Promise<ServiceResult<AdminActivityStatsDto>>;
  getCreatorStats(query: AdminStatsListQueryDto): Promise<ServiceResult<AdminCreatorStatsListDto>>;
}
