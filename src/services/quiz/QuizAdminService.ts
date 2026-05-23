import { IQuizRepository, IQuiz } from '@/interfaces/repositories/IQuizRepository';
import { ICategoryRepository } from '@/interfaces/repositories/ICategoryRepository';
import { QuizListOptions } from '@/interfaces/services/IQuizService';
import { ServiceResult } from '@/interfaces/services/types';
import { PaginationMeta } from '@/types';
import type { IQuestion } from '@/models/Quiz';
import type { FilterQuery } from 'mongoose';
import { logger } from '@/lib/logger';

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

    const filter: FilterQuery<IQuiz> = {};

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
      const searchRegex = new RegExp(escapeRegexLiteral(search.trim()), 'i');
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

  async approveQuiz(id: string): Promise<ServiceResult<IQuiz>> {
    try {
      const quiz = await this.quizRepository.updateStatus(id, 'published');

      if (!quiz) {
        return { success: false, error: 'Quiz not found', statusCode: 404 };
      }

      return {
        success: true,
        data: quiz,
      };
    } catch (error) {
      logger.error({ error }, 'Approve quiz error');
      return {
        success: false,
        error: 'Failed to approve quiz',
        statusCode: 500,
      };
    }
  }

  async rejectQuiz(id: string, reason?: string): Promise<ServiceResult<IQuiz>> {
    try {
      const quiz = await this.quizRepository.updateStatus(id, 'rejected', reason);

      if (!quiz) {
        return { success: false, error: 'Quiz not found', statusCode: 404 };
      }

      return {
        success: true,
        data: quiz,
      };
    } catch (error) {
      logger.error({ error }, 'Reject quiz error');
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
  ): Promise<ServiceResult<{ title: string; description: string; questions: IQuestion[] }>> {
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
