import { ICategory } from '@/interfaces/repositories/ICategoryRepository';
import type { PaginationMeta } from '@/types';

interface CategoryWithStats extends ICategory {
  quizCount: number;
}

interface CategoryBySlugResult {
  category: ICategory;
  quizzes: unknown[];
  pagination: PaginationMeta;
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
