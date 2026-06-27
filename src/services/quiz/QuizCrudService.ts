import { IQuizRepository, IQuiz } from '@/interfaces/repositories/IQuizRepository';
import { createSubscriptionService } from '@/lib/subscription-factory';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { CreateQuizRequest } from '@/interfaces/services/IQuizService';
import { ServiceResult } from '@/interfaces/services/types';
import { generateSlug } from '@/lib/utils';
import { getAuthorId } from './quiz-helpers';
import { logger } from '@/lib/logger';
import connectDB from '@/lib/mongoose';
import Folder from '@/models/Folder';
import { isValidObjectId } from 'mongoose';

const VALID_QUESTION_TYPES = new Set(['single', 'multiple']);

export class QuizCrudService {
  constructor(
    private quizRepository: IQuizRepository,
    private userRepository: IUserRepository,
  ) {}

  async createQuiz(userId: string, quizData: CreateQuizRequest): Promise<IQuiz> {
    const { title, description, folderId, questions, isPrivate, pdfUrl } = quizData;

    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
      throw new Error('Title and questions are required');
    }
    if (folderId) {
      if (!isValidObjectId(folderId)) throw new Error('Invalid folder selected');
      await connectDB();
      const ownsFolder = await Folder.exists({ _id: folderId, owner: userId });
      if (!ownsFolder) throw new Error('Invalid folder selected');
    }

    if (isPrivate) {
      const user = await this.userRepository.findById(userId);
      const canCreatePrivateQuiz =
        user?.role === 'admin' || (await createSubscriptionService().isUserPremium(userId));

      if (!canCreatePrivateQuiz) {
        throw new Error('Premium subscription required to create private quizzes');
      }
    }

    // Validate questions format
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];

      if (!question.question || typeof question.question !== 'string') {
        throw new Error(`Question ${i + 1}: Missing or invalid question text`);
      }

      if (!question.options || !Array.isArray(question.options)) {
        throw new Error(`Question ${i + 1}: Missing or invalid options array`);
      }

      const optionCount = question.options.length;

      if (optionCount < 2) {
        throw new Error(`Question ${i + 1}: Need at least 2 options`);
      }

      // Check each option is a string
      for (let j = 0; j < optionCount; j++) {
        if (typeof question.options[j] !== 'string') {
          throw new Error(`Question ${i + 1}, Option ${j + 1}: Must be a string`);
        }
      }

      // Validate question type and answers
      const questionType = question.type || 'single';
      if (!VALID_QUESTION_TYPES.has(questionType)) {
        throw new Error(`Question ${i + 1}: Type must be 'single' or 'multiple'`);
      }

      if (questionType === 'single') {
        if (
          typeof question.correctIndex !== 'number' ||
          question.correctIndex < 0 ||
          question.correctIndex >= optionCount
        ) {
          throw new Error(`Question ${i + 1}: Invalid correct answer index`);
        }
      } else {
        if (!Array.isArray(question.correctIndexes) || question.correctIndexes.length === 0) {
          throw new Error(
            `Question ${i + 1}: Multiple choice questions need at least one correct answer`,
          );
        }

        const validCorrectIndexes = new Set<number>();

        for (const idx of question.correctIndexes) {
          if (typeof idx !== 'number' || idx < 0 || idx >= optionCount) {
            throw new Error(`Question ${i + 1}: Invalid correct answer index`);
          }

          validCorrectIndexes.add(idx);
        }

        if (validCorrectIndexes.size !== question.correctIndexes.length) {
          throw new Error(`Question ${i + 1}: Duplicate correct answer indexes are not allowed`);
        }
      }
    }

    // Generate unique slug
    const baseSlug = generateSlug(title);
    let slug = baseSlug;
    let counter = 1;

    while (await this.quizRepository.findBySlug(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const quiz = await this.quizRepository.create({
      title,
      description,
      slug,
      author: userId,
      folder: folderId ?? null,
      questions,
      status: 'published',
      isPrivate: !!isPrivate,
      pdfUrl,
    });

    return quiz;
  }

  async getQuizBySlug(slug: string): Promise<IQuiz | null> {
    return await this.quizRepository.findBySlug(slug);
  }

  async getQuizById(
    id: string,
    userEmail?: string,
    userRole?: string,
    userId?: string,
  ): Promise<ServiceResult<IQuiz>> {
    try {
      const quiz = await this.quizRepository.findById(id);

      if (!quiz || !quiz._id) {
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
    quizData: Partial<IQuiz>,
    userId: string,
    userRole?: string,
  ): Promise<ServiceResult<IQuiz>> {
    try {
      const quiz = await this.quizRepository.findById(id);

      if (!quiz || !quiz._id) {
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

      if (!quiz || !quiz._id) {
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
