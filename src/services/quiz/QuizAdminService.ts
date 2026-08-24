import { IQuizRepository, type QuizFindFilter } from '@/interfaces/repositories/IQuizRepository';
import { ServiceResult } from '@/interfaces/services/types';
import type {
  AdminQuizDetailDto,
  AdminQuizListDto,
  AdminQuizListQueryDto,
} from '@/dtos/admin-quiz';
import type { DeleteResultDto } from '@/dtos/common';
import type { QuizListDto, QuizListOptionsDto } from '@/dtos/quiz';
import { logger } from '@/lib/logger';
import { AdminQuizDtoMapper } from '@/mappers/quiz/AdminQuizDtoMapper';
import { DeleteResultDtoMapper } from '@/mappers/common/DeleteResultDtoMapper';
import { QuizListDtoMapper } from '@/mappers/quiz/QuizListDtoMapper';

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyQuizSearchFilter(filter: QuizFindFilter, search?: string): void {
  const normalizedSearch = search?.trim();
  if (!normalizedSearch) return;

  const searchRegex = new RegExp(escapeRegexLiteral(normalizedSearch), 'i');
  filter.$or = [{ title: searchRegex }, { description: searchRegex }];
}

export class QuizAdminService {
  constructor(private quizRepository: IQuizRepository) {}

  async listAdminQuizzes(query: AdminQuizListQueryDto): Promise<ServiceResult<AdminQuizListDto>> {
    try {
      const { search, visibility, page, limit } = query;
      const filter: QuizFindFilter = {};

      if (visibility !== 'all') {
        filter.visibility = visibility;
      }

      applyQuizSearchFilter(filter, search);

      const result = await this.quizRepository.findAll(filter, {
        page,
        limit,
        sort: { createdAt: -1 },
      });

      return {
        success: true,
        data: AdminQuizDtoMapper.toListDto(result.items, result.pagination),
      };
    } catch (error) {
      logger.error({ error }, 'List admin quizzes error');
      return {
        success: false,
        error: 'Failed to list quizzes',
        statusCode: 500,
      };
    }
  }

  async getAdminQuiz(id: string): Promise<ServiceResult<AdminQuizDetailDto>> {
    try {
      const quiz = await this.quizRepository.findById(id);
      if (!quiz) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      return { success: true, data: AdminQuizDtoMapper.toDetail(quiz) };
    } catch (error) {
      logger.error({ error }, 'Get admin quiz error');
      return {
        success: false,
        error: 'Failed to get quiz',
        statusCode: 500,
      };
    }
  }

  async deleteAdminQuiz(id: string): Promise<ServiceResult<DeleteResultDto>> {
    try {
      const quiz = await this.quizRepository.findAccessById(id);
      if (!quiz) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      const deleted = await this.quizRepository.delete(id);
      if (!deleted) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      return { success: true, data: DeleteResultDtoMapper.toDto(id) };
    } catch (error) {
      logger.error({ error }, 'Delete admin quiz error');
      return {
        success: false,
        error: 'Failed to delete quiz',
        statusCode: 500,
      };
    }
  }

  async getQuizzes(options: QuizListOptionsDto): Promise<QuizListDto> {
    const { search, folder, page, limit, visibility, userId, onlyMine } = options;

    const filter: QuizFindFilter = {};

    if (onlyMine) {
      if (visibility !== undefined) filter.visibility = visibility;
    } else {
      filter.visibility = 'public';
    }

    // If caller wants only their own quizzes
    if (onlyMine && userId) {
      filter.author = userId;
    }

    if (onlyMine && folder !== undefined) {
      filter.folder = folder;
    }

    applyQuizSearchFilter(filter, search);

    const result = await this.quizRepository.findAll(filter, {
      page,
      limit,
      sort: { createdAt: -1 },
    });
    return {
      quizzes: result.items.map(QuizListDtoMapper.toListItem),
      pagination: result.pagination,
    };
  }
}
