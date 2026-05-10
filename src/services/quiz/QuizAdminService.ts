import { IQuizRepository, IQuiz } from '@/interfaces/repositories/IQuizRepository';
import { ICategoryRepository } from '@/interfaces/repositories/ICategoryRepository';
import { QuizListOptions } from '@/interfaces/services/IQuizService';
import { ServiceResult } from '@/interfaces/services/types';
import { PaginationMeta } from '@/types';

export class QuizAdminService {
  constructor(
    private quizRepository: IQuizRepository,
    private categoryRepository: ICategoryRepository,
  ) {}

  async getQuizzes(options: QuizListOptions): Promise<{
    quizzes: IQuiz[];
    pagination: PaginationMeta;
  }> {
    const {
      status,
      search,
      category,
      page = 1,
      limit = 10,
      isPrivate,
      userRole: _userRole,
      userId,
      onlyMine,
      compact,
    } = options;

    let filter: any = {};

    if (status) filter.status = status;
    if (typeof isPrivate === 'boolean') filter.isPrivate = isPrivate;

    // If caller wants only their own quizzes
    if (onlyMine && userId) {
      filter.author = userId;
    }

    // Add category filter
    if (category && category.trim()) {
      filter.category = category.trim();
    }

    // Add search functionality
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [{ title: searchRegex }, { description: searchRegex }],
      });
    }

    return await this.quizRepository.findAll(filter, {
      page,
      limit,
      sort: { createdAt: -1 },
      populate: ['author', 'category'],
      compact,
    });
  }

  async approveQuiz(id: string): Promise<ServiceResult<any>> {
    try {
      const quiz = await this.quizRepository.updateStatus(id, 'published');

      return {
        success: true,
        data: quiz,
      };
    } catch (error) {
      console.error('Approve quiz error:', error);
      return {
        success: false,
        error: 'Failed to approve quiz',
        statusCode: 500,
      };
    }
  }

  async rejectQuiz(id: string, reason?: string): Promise<ServiceResult<any>> {
    try {
      const quiz = await this.quizRepository.updateStatus(id, 'rejected', reason);

      return {
        success: true,
        data: quiz,
      };
    } catch (error) {
      console.error('Reject quiz error:', error);
      return {
        success: false,
        error: 'Failed to reject quiz',
        statusCode: 500,
      };
    }
  }

  async previewFromPdf(
    title: string,
    description: string,
    _pdfFiles: File[],
  ): Promise<ServiceResult<any>> {
    try {
      // This would typically process PDF files and extract questions
      // For now, return a mock preview
      return {
        success: true,
        data: {
          title,
          description,
          questions: [],
        },
      };
    } catch (_error) {
      return {
        success: false,
        error: 'Failed to preview from PDF',
        statusCode: 500,
      };
    }
  }
}
