import { ServiceResult } from '@/interfaces/services/types';
import type { PaginationMeta } from '@/types';

export interface SearchParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface AdminCategoryDTO {
  _id: string;
  name: string;
  description?: string;
  color?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AdminUserDTO {
  _id: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'user';
  createdAt?: Date;
}

export interface AdminPaginatedCategories {
  categories: AdminCategoryDTO[];
  pagination: PaginationMeta;
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

export interface AdminQuizStatusBreakdown {
  totalQuizzes: number;
  publishedQuizzes: number;
  pendingQuizzes: number;
  rejectedQuizzes: number;
}

export interface AdminStats extends AdminQuizStatusBreakdown {
  totalUsers: number;
  totalAdmins: number;
  totalAttempts: number;
  totalCategories: number;
  activeCategories: number;
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

export interface AdminActivityStats {
  timeBasedStats: {
    today: AdminTimeBucket;
    thisWeek: AdminTimeBucket;
    thisMonth: AdminTimeBucket;
  };
  recentActivity: {
    users: AdminRecentUser[];
    quizzes: unknown[];
    attempts: unknown[];
  };
}

export interface AdminCategoryStat {
  _id: string;
  name: string;
  quizCount: number;
}

export interface AdminCreatorStat {
  _id: string;
  email: string;
  quizCount: number;
}

export interface IAdminService {
  // Category management
  getCategories(searchParams: SearchParams): Promise<ServiceResult<AdminPaginatedCategories>>;
  createCategory(
    categoryData: Record<string, unknown>,
    adminId: string,
  ): Promise<ServiceResult<AdminCategoryDTO>>;
  updateCategory(
    id: string,
    categoryData: Record<string, unknown>,
  ): Promise<ServiceResult<AdminCategoryDTO>>;
  deleteCategory(id: string): Promise<ServiceResult<boolean>>;

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
  getCategoryStats(): Promise<ServiceResult<AdminCategoryStat[]>>;
  getCreatorStats(): Promise<ServiceResult<AdminCreatorStat[]>>;
}
