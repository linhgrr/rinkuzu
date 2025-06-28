import { ICategoryService } from '@/interfaces/services/ICategoryService'
import { ICategoryRepository } from '@/interfaces/repositories/ICategoryRepository'
import { IQuizRepository } from '@/interfaces/repositories/IQuizRepository'
import mongoose from 'mongoose'

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
      const categories = await this.categoryRepository.findActive();
      
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
      console.log('CategoryService.getCategoryBySlug called with slug:', slug);
      
      const category = await this.categoryRepository.findBySlug(slug);
      
      console.log('Category found:', category);
      console.log('Category _id:', category?._id);
      
      if (!category) {
        console.log('Category not found for slug:', slug);
        return {
          success: false,
          error: 'Category not found',
          statusCode: 404
        };
      }

      if (!category.isActive) {
        console.log('Category is inactive:', category.name);
        return {
          success: false,
          error: 'Category is inactive',
          statusCode: 404
        };
      }

      if (!category._id) {
        console.error('Category found but has no _id:', category);
        return {
          success: false,
          error: 'Category data is invalid',
          statusCode: 500
        };
      }

      // Convert category._id to ObjectId for the query
      const categoryObjectId = new mongoose.Types.ObjectId(category._id);
      console.log('Querying quizzes with category ObjectId:', categoryObjectId);
      
      // Build filter for quizzes
      const filter: any = {
        category: categoryObjectId,
        status: 'published',
        isPrivate: { $ne: true }
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
        populate: ['author', 'category']
      });

      // Transform quiz data to only include essential fields
      const transformedQuizzes = quizzesResult.quizzes.map((quiz: any) => ({
        _id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        slug: quiz.slug,
        author: quiz.author,
        category: quiz.category,
        createdAt: quiz.createdAt,
        status: quiz.status,
        questionCount: quiz.questions?.length || 0
      }));

      return {
        success: true,
        data: {
          category,
          quizzes: transformedQuizzes,
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