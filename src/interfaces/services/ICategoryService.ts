import { IQuiz } from '@/interfaces/repositories/IQuizRepository';
import type { ICategory as ICategoryDoc } from '@/interfaces/repositories/ICategoryRepository';
import type { PaginationMeta } from '@/types';
import type { ServiceResult } from '@/interfaces/services/types';

export interface CategoryWithStats {
  _id: string;
  name: string;
  description?: string;
  color: string;
  slug?: string;
  quizCount: number;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryBySlugResult {
  category: ICategoryDoc;
  quizzes: IQuiz[];
  pagination: PaginationMeta;
}

export interface ICategoryService {
  getCategories(): Promise<ServiceResult<CategoryWithStats[]>>;
  getCategoryBySlug(
    slug: string,
    page?: number,
    limit?: number,
    search?: string,
  ): Promise<ServiceResult<CategoryBySlugResult>>;
  searchCategories(query: string): Promise<ServiceResult<ICategoryDoc[]>>;
  getCategoryStats(): Promise<ServiceResult<CategoryWithStats[]>>;
}
