import { ICategory } from '@/interfaces/repositories/ICategoryRepository';

export interface CategoryWithStats extends ICategory {
  quizCount: number;
}

export interface CategoryBySlugResult {
  category: ICategory;
  quizzes: unknown[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ICategoryService {
  getCategories(): Promise<{
    success: boolean;
    data?: CategoryWithStats[];
    error?: string;
    statusCode?: number;
  }>;

  getCategoryBySlug(
    slug: string,
    page?: number,
    limit?: number,
    search?: string,
  ): Promise<{
    success: boolean;
    data?: CategoryBySlugResult;
    error?: string;
    statusCode?: number;
  }>;

  searchCategories(query: string): Promise<{
    success: boolean;
    data?: ICategory[];
    error?: string;
    statusCode?: number;
  }>;

  getCategoryStats(): Promise<{
    success: boolean;
    data?: CategoryWithStats[];
    error?: string;
    statusCode?: number;
  }>;
}
