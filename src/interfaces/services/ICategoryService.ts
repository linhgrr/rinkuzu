export interface ICategoryService {
  getCategories(): Promise<{
    success: boolean;
    data?: any[];
    error?: string;
    statusCode?: number;
  }>;

  getCategoryBySlug(slug: string, page?: number, limit?: number, search?: string): Promise<{
    success: boolean;
    data?: any;
    error?: string;
    statusCode?: number;
  }>;

  searchCategories(query: string): Promise<{
    success: boolean;
    data?: any[];
    error?: string;
    statusCode?: number;
  }>;

  getCategoryStats(): Promise<{
    success: boolean;
    data?: any[];
    error?: string;
    statusCode?: number;
  }>;
} 