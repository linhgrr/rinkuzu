interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export interface IAdminService {
  // Category management
  getCategories(searchParams: any): Promise<ServiceResult<any>>;
  createCategory(categoryData: any, adminId: string): Promise<ServiceResult<any>>;
  updateCategory(id: string, categoryData: any): Promise<ServiceResult<any>>;
  deleteCategory(id: string): Promise<ServiceResult<boolean>>;

  // User management
  getUsers(searchParams: any): Promise<ServiceResult<any>>;
  updateUserRole(userId: string, role: string, adminEmail: string): Promise<ServiceResult<any>>;
  deleteUser(userId: string, adminEmail: string): Promise<ServiceResult<boolean>>;

  // Reports management
  getReports(searchParams: any): Promise<ServiceResult<any>>;
  updateReportStatus(reportId: string, status: string): Promise<ServiceResult<any>>;

  // Statistics
  getStats(): Promise<ServiceResult<any>>;
  getActivityStats(): Promise<ServiceResult<any>>;
  getCategoryStats(): Promise<ServiceResult<any>>;
  getCreatorStats(): Promise<ServiceResult<any>>;

  // Setup
  initializeSystem(): Promise<ServiceResult<any>>;
} 