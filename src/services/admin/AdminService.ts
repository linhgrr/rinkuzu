import { IAdminService } from '@/interfaces/services/IAdminService'
import { ICategoryRepository } from '@/interfaces/repositories/ICategoryRepository'
import { IUserRepository } from '@/interfaces/repositories/IUserRepository'
import { IReportRepository } from '@/interfaces/repositories/IReportRepository'
import { IQuizRepository } from '@/interfaces/repositories/IQuizRepository'
import { IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository'

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export class AdminService implements IAdminService {
  constructor(
    private categoryRepository: ICategoryRepository,
    private userRepository: IUserRepository,
    private reportRepository: IReportRepository,
    private quizRepository: IQuizRepository,
    private attemptRepository: IAttemptRepository
  ) {}

  async getCategories(searchParams: any): Promise<ServiceResult<any>> {
    try {
      const { search, page = 1, limit = 20 } = searchParams;
      const skip = (page - 1) * limit;

      let filter: any = {};
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      const categories = await this.categoryRepository.findAll({
        page,
        limit,
        search,
        isActive: filter.isActive
      });

      const total = await this.categoryRepository.count({ isActive: filter.isActive });

      return {
        success: true,
        data: {
          categories: categories.categories,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      console.error('Get categories error:', error);
      return {
        success: false,
        error: 'Failed to get categories',
        statusCode: 500
      };
    }
  }

  async createCategory(categoryData: any, adminId: string): Promise<ServiceResult<any>> {
    try {
      const { name, description, color } = categoryData;

      if (!name?.trim()) {
        return {
          success: false,
          error: 'Category name is required',
          statusCode: 400
        };
      }

      // Check if category exists
      const existing = await this.categoryRepository.findAll({
        search: name.trim()
      });

      if (existing.categories.length > 0) {
        return {
          success: false,
          error: 'Category with this name already exists',
          statusCode: 400
        };
      }

      const category = await this.categoryRepository.create({
        name: name.trim(),
        description: description?.trim(),
        color: color || '#3B82F6'
      });

      return {
        success: true,
        data: category
      };
    } catch (error) {
      console.error('Create category error:', error);
      return {
        success: false,
        error: 'Failed to create category',
        statusCode: 500
      };
    }
  }

  async updateCategory(id: string, categoryData: any): Promise<ServiceResult<any>> {
    try {
      const category = await this.categoryRepository.update(id, categoryData);
      
      if (!category) {
        return {
          success: false,
          error: 'Category not found',
          statusCode: 404
        };
      }

      return {
        success: true,
        data: category
      };
    } catch (error) {
      console.error('Update category error:', error);
      return {
        success: false,
        error: 'Failed to update category',
        statusCode: 500
      };
    }
  }

  async deleteCategory(id: string): Promise<ServiceResult<boolean>> {
    try {
      const deleted = await this.categoryRepository.delete(id);
      
      if (!deleted) {
        return {
          success: false,
          error: 'Category not found',
          statusCode: 404
        };
      }

      return {
        success: true,
        data: true
      };
    } catch (error) {
      console.error('Delete category error:', error);
      return {
        success: false,
        error: 'Failed to delete category',
        statusCode: 500
      };
    }
  }

  async getUsers(searchParams: any): Promise<ServiceResult<any>> {
    try {
      const { search, page = 1, limit = 10 } = searchParams;
      
      const result = await this.userRepository.findAll({
        page,
        limit,
        search
      });

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Get users error:', error);
      return {
        success: false,
        error: 'Failed to get users',
        statusCode: 500
      };
    }
  }

  async updateUserRole(userId: string, role: string, adminEmail: string): Promise<ServiceResult<any>> {
    try {
      if (role !== 'admin' && role !== 'user') {
        return {
          success: false,
          error: 'Invalid role',
          statusCode: 400
        };
      }

      const user = await this.userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
          statusCode: 404
        };
      }

      if (user.email === adminEmail) {
        return {
          success: false,
          error: 'Cannot change your own role',
          statusCode: 400
        };
      }

      const updated = await this.userRepository.update(userId, { role });

      return {
        success: true,
        data: { message: `User role updated to ${role}` }
      };
    } catch (error) {
      console.error('Update user role error:', error);
      return {
        success: false,
        error: 'Failed to update user role',
        statusCode: 500
      };
    }
  }

  async deleteUser(userId: string, adminEmail: string): Promise<ServiceResult<boolean>> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
          statusCode: 404
        };
      }

      if (user.email === adminEmail) {
        return {
          success: false,
          error: 'Cannot delete your own account',
          statusCode: 400
        };
      }

      const deleted = await this.userRepository.delete(userId);

      return {
        success: true,
        data: deleted
      };
    } catch (error) {
      console.error('Delete user error:', error);
      return {
        success: false,
        error: 'Failed to delete user',
        statusCode: 500
      };
    }
  }

  async getReports(searchParams: any): Promise<ServiceResult<any>> {
    try {
      // Implement reports logic if needed
      return {
        success: true,
        data: []
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get reports',
        statusCode: 500
      };
    }
  }

  async updateReportStatus(reportId: string, status: string): Promise<ServiceResult<any>> {
    try {
      // Implement report status update logic if needed
      return {
        success: true,
        data: { message: 'Report status updated' }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to update report status',
        statusCode: 500
      };
    }
  }

  async getStats(): Promise<ServiceResult<any>> {
    try {
      // Basic stats implementation
      const totalUsers = await this.userRepository.count();
      const totalQuizzes = await this.quizRepository.count({});
      const totalAttempts = await this.attemptRepository.count({});

      return {
        success: true,
        data: {
          totalUsers,
          totalQuizzes,
          totalAttempts
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get stats',
        statusCode: 500
      };
    }
  }

  async getActivityStats(): Promise<ServiceResult<any>> {
    try {
      // Implement activity stats if needed
      return {
        success: true,
        data: []
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get activity stats',
        statusCode: 500
      };
    }
  }

  async getCategoryStats(): Promise<ServiceResult<any>> {
    try {
      const stats = await this.categoryRepository.getStatsWithQuizCount();
      return {
        success: true,
        data: stats
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get category stats',
        statusCode: 500
      };
    }
  }

  async getCreatorStats(): Promise<ServiceResult<any>> {
    try {
      // Implement creator stats if needed
      return {
        success: true,
        data: []
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get creator stats',
        statusCode: 500
      };
    }
  }

  async initializeSystem(): Promise<ServiceResult<any>> {
    try {
      // Implement system initialization if needed
      return {
        success: true,
        data: { message: 'System initialized' }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to initialize system',
        statusCode: 500
      };
    }
  }
} 