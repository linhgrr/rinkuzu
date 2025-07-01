export interface ICategory {
  _id: string;
  name: string;
  description?: string;
  color?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICategoryRepository {
  findById(id: string): Promise<ICategory | null>;
  findBySlug(slug: string): Promise<ICategory | null>;
  findAll(options?: {
    page?: number
    limit?: number
    search?: string
    isActive?: boolean
  }): Promise<{
    categories: ICategory[]
    pagination: {
      currentPage: number
      totalPages: number
      totalItems: number
      itemsPerPage: number
      hasNextPage: boolean
      hasPrevPage: boolean
    }
  }>;
  findActive(): Promise<ICategory[]>;
  search(query: string): Promise<ICategory[]>;
  getStatsWithQuizCount(): Promise<any[]>;
  create(categoryData: Partial<ICategory>): Promise<ICategory>;
  update(id: string, categoryData: Partial<ICategory>): Promise<ICategory | null>;
  delete(id: string): Promise<boolean>;
  count(filter: any): Promise<number>;
  findWithQuizCount(): Promise<{ category: ICategory; quizCount: number }[]>;
} 