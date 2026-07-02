import { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { Quiz } from '@/entities/Quiz';
import { createSubscriptionService } from '@/lib/subscription-factory';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import type { IFolderRepository } from '@/interfaces/repositories/IFolderRepository';
import type { CreateQuizRequestDto, UpdateQuizRequestDto } from '@/dtos/quiz';
import { ServiceResult } from '@/interfaces/services/types';
import { generateSlug } from '@/lib/utils';
import { getAuthorId } from './quiz-helpers';
import { logger } from '@/lib/logger';
import { QuizCreationError } from '@/lib/quiz/errors';
import { isMongoDuplicateKeyError, isMongoDuplicateKeyErrorForField } from '@/lib/mongoose-errors';

const MAX_SLUG_CREATE_ATTEMPTS = 20;

export class QuizCrudService {
  constructor(
    private quizRepository: IQuizRepository,
    private userRepository: IUserRepository,
    private folderRepository?: IFolderRepository,
  ) {}

  async createQuiz(userId: string, quizData: CreateQuizRequestDto): Promise<Quiz> {
    return this.createQuizRecord(userId, quizData);
  }

  async createQuizFromDraft(
    userId: string,
    sourceDraftId: string,
    quizData: CreateQuizRequestDto,
  ): Promise<Quiz> {
    const existing = await this.quizRepository.findBySourceDraftId(sourceDraftId);
    if (existing) {
      if (getAuthorId(existing.author) !== userId) {
        throw new QuizCreationError('invalid_draft', 'Draft belongs to another user');
      }
      return existing;
    }

    try {
      return await this.createQuizRecord(userId, quizData, sourceDraftId);
    } catch (error) {
      if (!isMongoDuplicateKeyError(error)) {
        throw error;
      }

      const concurrentlyCreated = await this.quizRepository.findBySourceDraftId(sourceDraftId);
      if (!concurrentlyCreated || getAuthorId(concurrentlyCreated.author) !== userId) {
        throw error;
      }
      return concurrentlyCreated;
    }
  }

  private async createQuizRecord(
    userId: string,
    quizData: CreateQuizRequestDto,
    sourceDraftId?: string,
  ): Promise<Quiz> {
    const { title, description, folderId, questions, isPrivate, pdfUrl } = quizData;

    if (folderId) {
      const ownsFolder = await this.folderRepository?.existsOwnedById(folderId, userId);
      if (!ownsFolder) {
        throw new QuizCreationError('invalid_folder', 'Invalid folder selected');
      }
    }

    if (isPrivate) {
      const user = await this.userRepository.findById(userId);
      const canCreatePrivateQuiz =
        user?.role === 'admin' || (await createSubscriptionService().isUserPremium(userId));

      if (!canCreatePrivateQuiz) {
        throw new QuizCreationError(
          'premium_required',
          'Premium subscription required to create private quizzes',
        );
      }
    }

    const baseSlug = generateSlug(title);

    for (let attempt = 0; attempt < MAX_SLUG_CREATE_ATTEMPTS; attempt += 1) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;

      try {
        return await this.quizRepository.create({
          title,
          description,
          slug,
          author: userId,
          folder: folderId ?? null,
          questions,
          isPrivate,
          pdfUrl,
          sourceDraftId,
        });
      } catch (error) {
        if (!isMongoDuplicateKeyErrorForField(error, 'slug')) {
          throw error;
        }
      }
    }

    throw new QuizCreationError('slug_conflict', 'Could not generate a unique quiz slug');
  }

  async getQuizBySlug(slug: string): Promise<Quiz | null> {
    return await this.quizRepository.findBySlug(slug);
  }

  async getQuizById(
    id: string,
    userEmail?: string,
    userRole?: string,
    userId?: string,
  ): Promise<ServiceResult<Quiz>> {
    try {
      const quiz = await this.quizRepository.findById(id);

      if (!quiz) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      // Check permissions for private quizzes
      if (quiz.isPrivate) {
        if (!userEmail) {
          return {
            success: false,
            error: 'Authentication required to access private quiz',
            statusCode: 401,
          };
        }

        // Admin can access all private quizzes
        if (userRole === 'admin') {
          return { success: true, data: quiz };
        }

        // Author can access their own private quizzes
        if (getAuthorId(quiz.author) === userId) {
          return { success: true, data: quiz };
        }

        // Check if user has premium subscription
        if (userId) {
          const subscriptionService = createSubscriptionService();
          const isPremium = await subscriptionService.isUserPremium(userId);

          if (!isPremium) {
            return {
              success: false,
              error: 'Premium subscription required to access private quizzes',
              statusCode: 403,
            };
          }
        } else {
          return {
            success: false,
            error: 'Premium subscription required to access private quizzes',
            statusCode: 403,
          };
        }
      }

      return { success: true, data: quiz };
    } catch (error) {
      logger.error({ error }, 'Error in getQuizById');
      return {
        success: false,
        error: 'Internal server error',
        statusCode: 500,
      };
    }
  }

  async updateQuiz(
    id: string,
    quizData: UpdateQuizRequestDto,
    userId: string,
    userRole?: string,
  ): Promise<ServiceResult<Quiz>> {
    try {
      const quiz = await this.quizRepository.findById(id);

      if (!quiz) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      // Check permissions
      const isAdmin = userRole === 'admin';
      const isAuthor = getAuthorId(quiz.author) === userId;

      if (!isAdmin && !isAuthor) {
        return {
          success: false,
          error: 'Access denied',
          statusCode: 403,
        };
      }

      if (quizData.isPrivate && !quiz.isPrivate && !isAdmin) {
        const user = await this.userRepository.findById(userId);
        const isPremium = user ? await createSubscriptionService().isUserPremium(userId) : false;

        if (!isPremium) {
          return {
            success: false,
            error: 'Premium subscription required to create private quizzes',
            statusCode: 403,
          };
        }
      }

      if (quizData.folder) {
        const ownsFolder = await this.folderRepository?.existsOwnedById(quizData.folder, userId);
        if (!ownsFolder) {
          return {
            success: false,
            error: 'Invalid folder selected',
            statusCode: 400,
          };
        }
      }

      const updatedQuiz = await this.quizRepository.update(id, quizData);

      if (!updatedQuiz) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      return {
        success: true,
        data: updatedQuiz,
      };
    } catch (error) {
      logger.error({ error }, 'Update quiz error');
      return {
        success: false,
        error: 'Failed to update quiz',
        statusCode: 500,
      };
    }
  }

  async deleteQuiz(id: string, userId: string, userRole?: string): Promise<ServiceResult<boolean>> {
    try {
      const quiz = await this.quizRepository.findById(id);

      if (!quiz) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      // Check permissions
      const isAdmin = userRole === 'admin';
      const isAuthor = getAuthorId(quiz.author) === userId;

      if (!isAdmin && !isAuthor) {
        return {
          success: false,
          error: 'Access denied',
          statusCode: 403,
        };
      }

      const result = await this.quizRepository.delete(id);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      logger.error({ error }, 'Delete quiz error');
      return {
        success: false,
        error: 'Failed to delete quiz',
        statusCode: 500,
      };
    }
  }
}
