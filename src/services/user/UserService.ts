import { IUserService } from '@/interfaces/services/IUserService'
import { IUserRepository } from '@/interfaces/repositories/IUserRepository'
import { IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository'
import { IUser } from '@/types/index'

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export class UserService implements IUserService {
  constructor(
    private userRepository: IUserRepository,
    private attemptRepository: IAttemptRepository
  ) {}

  async getUserAttempts(userEmail: string, options?: { page?: number, limit?: number }): Promise<{
    attempts: any[]
    pagination: {
      currentPage: number
      totalPages: number
      totalItems: number
      itemsPerPage: number
      hasNextPage: boolean
      hasPrevPage: boolean
    }
  }> {
    try {
      console.log('UserService.getUserAttempts called with:', userEmail, options);
      
      // Find user first
      const user = await this.userRepository.findByEmail(userEmail)
      console.log('Found user:', user?._id);
      
      if (!user) {
        throw new Error('User not found')
      }

      const page = options?.page || 1
      const limit = options?.limit || 10
      const result = await this.attemptRepository.findByUser(user._id.toString(), { page, limit })
      
      console.log('AttemptRepository result:', result);
      
      // Format attempts
      const formattedAttempts = result.attempts.map(attempt => ({
        _id: attempt._id,
        score: attempt.score,
        takenAt: attempt.takenAt,
        quiz: {
          title: attempt.quiz.title,
          slug: attempt.quiz.slug,
          description: attempt.quiz.description,
          totalQuestions: attempt.quiz.questions.length,
        },
      }))

      console.log('Formatted attempts:', formattedAttempts);

      return {
        attempts: formattedAttempts,
        pagination: result.pagination
      }
    } catch (error) {
      console.error('Get user attempts error:', error)
      throw error
    }
  }

  async getUserById(id: string): Promise<IUser | null> {
    return await this.userRepository.findById(id)
  }

  async getUserByEmail(email: string): Promise<IUser | null> {
    return await this.userRepository.findByEmail(email)
  }

  async updateUser(id: string, userData: Partial<IUser>): Promise<IUser | null> {
    return await this.userRepository.update(id, userData)
  }

  async deleteUser(id: string): Promise<boolean> {
    return await this.userRepository.delete(id)
  }

  async getAllUsers(options?: {
    page?: number
    limit?: number
    search?: string
    role?: string
  }): Promise<{
    users: IUser[]
    pagination: {
      currentPage: number
      totalPages: number
      totalItems: number
      itemsPerPage: number
      hasNextPage: boolean
      hasPrevPage: boolean
    }
  }> {
    return await this.userRepository.findAll(options)
  }

  async getAttemptDetails(attemptId: string, userEmail: string): Promise<ServiceResult<any>> {
    try {
      // Find user
      const user = await this.userRepository.findByEmail(userEmail);
      let userId: string;
      
      if (user) {
        // Logged in user
        userId = user._id.toString();
      } else {
        // Anonymous user - use email as identifier
        userId = userEmail;
      }

      // Get attempt with quiz details
      const attempt = await this.attemptRepository.findByIdWithQuiz(attemptId, userId);
      
      if (!attempt) {
        return {
          success: false,
          error: 'Attempt not found',
          statusCode: 404
        };
      }

      // Format the response with question details and user answers
      const formattedAttempt = {
        _id: attempt._id,
        score: attempt.score,
        takenAt: attempt.takenAt,
        answers: attempt.answers,
        quiz: {
          title: attempt.quiz.title,
          slug: attempt.quiz.slug,
          description: attempt.quiz.description,
          questions: attempt.quiz.questions.map((question: any, index: number) => ({
            question: question.question,
            options: question.options,
            type: question.type,
            correctIndex: question.correctIndex,
            correctIndexes: question.correctIndexes,
            questionImage: question.questionImage,
            optionImages: question.optionImages,
            userAnswer: attempt.answers[index],
            isCorrect: question.type === 'single' 
              ? attempt.answers[index] === question.correctIndex
              : Array.isArray(attempt.answers[index]) && Array.isArray(question.correctIndexes)
                ? question.correctIndexes.length === attempt.answers[index].length &&
                  question.correctIndexes.every((idx: number) => attempt.answers[index].includes(idx))
                : false
          }))
        },
      };

      return {
        success: true,
        data: formattedAttempt
      };
    } catch (error) {
      console.error('Get attempt details error:', error);
      return {
        success: false,
        error: 'Failed to get attempt details',
        statusCode: 500
      };
    }
  }
} 