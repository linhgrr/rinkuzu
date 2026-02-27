import { ICategoryService } from '@/interfaces/services/ICategoryService'
import { ICategoryRepository } from '@/interfaces/repositories/ICategoryRepository'
import { IQuizRepository } from '@/interfaces/repositories/IQuizRepository'

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export class CategoryService implements ICategoryService {
  constructor(
    private categoryRepository: ICategoryRepository,
    private quizRepository: IQuizRepository
  ) {}

  async getCategories(): Promise<ServiceResult<any[]>> {
    try {
      const categoriesWithStats = await this.categoryRepository.getStatsWithQuizCount();
      
      // Transform the data to include slug
      const categories = categoriesWithStats.map((cat: any) => ({
        _id: cat._id,
        name: cat.name,
        description: cat.description,
        color: cat.color,
        quizCount: cat.quizCount,
        slug: cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        isActive: cat.isActive,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt
      }));
      
      return {
        success: true,
        data: categories
      };
    } catch (error) {
      console.error('Get categories error:', error);
      return {
        success: false,
        error: 'Failed to fetch categories',
        statusCode: 500
      };
    }
  }

  async getCategoryBySlug(slug: string, page: number = 1, limit: number = 12, search?: string): Promise<ServiceResult<any>> {
    try {
      const category = await this.categoryRepository.findBySlug(slug);

      if (!category) {
        return {
          success: false,
          error: 'Category not found',
          statusCode: 404
        };
      }

      if (!category.isActive) {
        return {
          success: false,
          error: 'Category is inactive',
          statusCode: 404
        };
      }

      if (!category._id) {
        return {
          success: false,
          error: 'Category data is invalid',
          statusCode: 500
        };
      }
      
      // Build filter for quizzes
      const filter: any = {
        category: category._id,
        status: 'published',
        isPrivate: false,
      };

      // Add search filter if provided
      if (search && search.trim()) {
        filter.$or = [
          { title: { $regex: search.trim(), $options: 'i' } },
          { description: { $regex: search.trim(), $options: 'i' } }
        ];
      }

      // Get published quizzes in this category with pagination
      const quizzesResult = await this.quizRepository.findAll(filter, {
        page,
        limit,
        sort: { createdAt: -1 },
        populate: ['author', 'category'],
        compact: true,
      });

      return {
        success: true,
        data: {
          category,
          quizzes: quizzesResult.quizzes,
          pagination: quizzesResult.pagination
        }
      };
    } catch (error) {
      console.error('Get category by slug error:', error);
      return {
        success: false,
        error: 'Failed to get category',
        statusCode: 500
      };
    }
  }

  async searchCategories(query: string): Promise<ServiceResult<any[]>> {
    try {
      if (!query.trim()) {
        return {
          success: false,
          error: 'Search query is required',
          statusCode: 400
        };
      }

      const categories = await this.categoryRepository.search(query.trim());
      
      return {
        success: true,
        data: categories
      };
    } catch (error) {
      console.error('Search categories error:', error);
      return {
        success: false,
        error: 'Failed to search categories',
        statusCode: 500
      };
    }
  }

  async getCategoryStats(): Promise<ServiceResult<any[]>> {
    try {
      const stats = await this.categoryRepository.getStatsWithQuizCount();
      
      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('Get category stats error:', error);
      return {
        success: false,
        error: 'Failed to get category stats',
        statusCode: 500
      };
    }
  }
} 
