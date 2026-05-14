import { ServiceResult } from '@/interfaces/services/types';

interface SearchParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface IAdminService {
  // Category management
  getCategories(searchParams: SearchParams): Promise<ServiceResult<any>>;
  createCategory(
    categoryData: Record<string, unknown>,
    adminId: string,
  ): Promise<ServiceResult<any>>;
  updateCategory(id: string, categoryData: Record<string, unknown>): Promise<ServiceResult<any>>;
  deleteCategory(id: string): Promise<ServiceResult<boolean>>;

  // User management
  getUsers(searchParams: SearchParams): Promise<ServiceResult<any>>;
  updateUserRole(userId: string, role: string, adminEmail: string): Promise<ServiceResult<any>>;
  deleteUser(userId: string, adminEmail: string): Promise<ServiceResult<boolean>>;

  // Reports management
  getReports(searchParams: SearchParams): Promise<ServiceResult<any>>;
  updateReportStatus(reportId: string, status: string): Promise<ServiceResult<any>>;
  deleteReport(reportId: string): Promise<ServiceResult<boolean>>;

  // Statistics
  getStats(): Promise<ServiceResult<any>>;
  getActivityStats(): Promise<ServiceResult<any>>;
  getCategoryStats(): Promise<ServiceResult<any>>;
  getCreatorStats(): Promise<ServiceResult<any>>;

  // Setup
  initializeSystem(): Promise<ServiceResult<any>>;
}
