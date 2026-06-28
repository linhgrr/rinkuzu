import { ServiceResult } from '@/interfaces/services/types';
import type { PaginationMeta } from '@/types';

export interface SearchParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface AdminUserDTO {
  _id: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'user';
  createdAt?: Date;
}

export interface AdminPaginatedUsers {
  users: AdminUserDTO[];
  pagination: PaginationMeta;
}

export interface AdminMessageResult {
  message: string;
}

export interface AdminReportItem {
  _id: string;
  status?: string;
  reason?: string;
  createdAt?: Date;
}

export interface AdminPaginatedReports {
  reports: AdminReportItem[];
  pagination?: PaginationMeta;
}

export interface AdminStats {
  totalQuizzes: number;
  totalUsers: number;
  totalAdmins: number;
  totalAttempts: number;
}

export interface AdminTimeBucket {
  newUsers: number;
  newQuizzes: number;
  attempts: number;
}

export interface AdminRecentUser {
  email: string;
  createdAt?: Date;
}

export interface AdminRecentAttempt {
  id: string;
  score: number;
  takenAt: Date;
  user: { email: string } | null;
  quiz: { title: string } | null;
}

export interface AdminActivityStats {
  timeBasedStats: {
    today: AdminTimeBucket;
    thisWeek: AdminTimeBucket;
    thisMonth: AdminTimeBucket;
  };
  recentActivity: {
    users: AdminRecentUser[];
    quizzes: unknown[];
    attempts: AdminRecentAttempt[];
  };
}

export interface AdminCreatorStat {
  _id: string;
  email: string;
  quizCount: number;
}

export interface IAdminService {
  // User management
  getUsers(searchParams: SearchParams): Promise<ServiceResult<AdminPaginatedUsers>>;
  updateUserRole(
    userId: string,
    role: string,
    adminEmail: string,
  ): Promise<ServiceResult<AdminMessageResult>>;
  deleteUser(userId: string, adminEmail: string): Promise<ServiceResult<boolean>>;

  // Reports management
  getReports(searchParams: SearchParams): Promise<ServiceResult<AdminReportItem[]>>;
  updateReportStatus(reportId: string, status: string): Promise<ServiceResult<AdminMessageResult>>;
  deleteReport(reportId: string): Promise<ServiceResult<boolean>>;

  // Statistics
  getStats(): Promise<ServiceResult<AdminStats>>;
  getActivityStats(): Promise<ServiceResult<AdminActivityStats>>;
  getCreatorStats(): Promise<ServiceResult<AdminCreatorStat[]>>;
}
