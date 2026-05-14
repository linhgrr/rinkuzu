import { IQuizRepository, IQuiz } from '@/interfaces/repositories/IQuizRepository';
import { ICategoryRepository } from '@/interfaces/repositories/ICategoryRepository';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { CreateQuizRequest } from '@/interfaces/services/IQuizService';
import { ServiceResult } from '@/interfaces/services/types';
import { generateSlug } from '@/lib/utils';
import { ServiceFactory } from '@/lib/serviceFactory';
import { getAuthorId } from './quiz-helpers';

const VALID_QUESTION_TYPES = new Set(['single', 'multiple']);

export class QuizCrudService {
  constructor(
    private quizRepository: IQuizRepository,
    private categoryRepository: ICategoryRepository,
    private userRepository: IUserRepository,
  ) {}

  async createQuiz(userId: string, quizData: CreateQuizRequest): Promise<IQuiz> {
    const { title, description, category, questions, isPrivate, pdfUrl } = quizData;

    if (!title || !category || !questions || !Array.isArray(questions) || questions.length === 0) {
      throw new Error('Title, category, and questions are required');
    }

    // Validate category exists and is active
    const categoryDoc = await this.categoryRepository.findById(category);
    if (!categoryDoc || !categoryDoc.isActive) {
      throw new Error('Invalid or inactive category selected');
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
      category,
      questions,
      status: 'pending',
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
  ): Promise<ServiceResult<any>> {
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
          const subscriptionService = ServiceFactory.createSubscriptionService();
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
      console.error('Error in getQuizById:', error);
      return {
        success: false,
        error: 'Internal server error',
        statusCode: 500,
      };
    }
  }

  async updateQuiz(
    id: string,
    quizData: any,
    userEmail: string,
    userRole?: string,
  ): Promise<ServiceResult<any>> {
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
      const isAuthor = (quiz.author as any)?._id
        ? (quiz.author as any)._id.toString() === userEmail
        : quiz.author === userEmail;

      if (!isAdmin && !isAuthor) {
        return {
          success: false,
          error: 'Access denied',
          statusCode: 403,
        };
      }

      const updatedQuiz = await this.quizRepository.update(id, quizData);

      return {
        success: true,
        data: updatedQuiz,
      };
    } catch (error) {
      console.error('Update quiz error:', error);
      return {
        success: false,
        error: 'Failed to update quiz',
        statusCode: 500,
      };
    }
  }

  async deleteQuiz(
    id: string,
    userEmail: string,
    userRole?: string,
  ): Promise<ServiceResult<boolean>> {
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
      const isAuthor = (quiz.author as any)?._id
        ? (quiz.author as any)._id.toString() === userEmail
        : quiz.author === userEmail;

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
      console.error('Delete quiz error:', error);
      return {
        success: false,
        error: 'Failed to delete quiz',
        statusCode: 500,
      };
    }
  }
}
