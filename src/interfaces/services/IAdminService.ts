import { ServiceResult } from '@/interfaces/services/types';
import type { DeleteResultDto } from '@/dtos/common';
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
} from '@/dtos/admin-stats';

export interface IAdminService {
  // User management
  getUsers(searchParams: AdminUserListQueryDto): Promise<ServiceResult<AdminUserListDto>>;
  updateUserRole(
    userId: string,
    role: UpdateAdminUserRoleRequestDto['role'],
    adminEmail: string,
  ): Promise<ServiceResult<AdminMessageDto>>;
  deleteUser(userId: string, adminEmail: string): Promise<ServiceResult<DeleteResultDto>>;

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
  getCreatorStats(limit: number): Promise<ServiceResult<AdminCreatorStatDto[]>>;
}
