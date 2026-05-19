import { IUserService } from '@/interfaces/services/IUserService';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository';
import { IUser } from '@/types/index';
import { ServiceResult } from '@/interfaces/services/types';
import type { IQuestion } from '@/models/Quiz';

export interface UserAttemptSummary {
  _id: string;
  score: number;
  takenAt: Date;
  quiz: {
    title: string;
    slug: string;
    description: string;
    totalQuestions: number;
  };
}

export interface AttemptQuestionDetail {
  question: string;
  options: string[];
  type: 'single' | 'multiple';
  correctIndex?: number;
  correctIndexes?: number[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
  userAnswer: number | number[];
  isCorrect: boolean;
}

export interface AttemptDetails {
  _id: string;
  score: number;
  takenAt: Date;
  answers: (number | number[])[];
  quiz: {
    title: string;
    slug: string;
    description: string;
    questions: AttemptQuestionDetail[];
  };
}

export class UserService implements IUserService {
  constructor(
    private userRepository: IUserRepository,
    private attemptRepository: IAttemptRepository,
  ) {}

  async getUserAttempts(
    userEmail: string,
    options?: { page?: number; limit?: number },
  ): Promise<{
    attempts: UserAttemptSummary[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    try {
      // Find user first
      const user = await this.userRepository.findByEmail(userEmail);

      if (!user) {
        throw new Error('User not found');
      }

      const page = options?.page || 1;
      const limit = options?.limit || 10;
      const result = await this.attemptRepository.findByUser(user._id.toString(), { page, limit });

      // Format attempts - quiz is always populated from findByUser
      const formattedAttempts: UserAttemptSummary[] = result.attempts.map((attempt) => {
        const populatedQuiz = attempt.quiz as {
          _id: string;
          title?: string;
          slug?: string;
          description?: string;
          questions?: unknown[];
        };
        return {
          _id: String(attempt._id),
          score: attempt.score,
          takenAt: attempt.takenAt,
          quiz: {
            title: populatedQuiz.title ?? '',
            slug: populatedQuiz.slug ?? '',
            description: populatedQuiz.description ?? '',
            totalQuestions: populatedQuiz.questions?.length ?? 0,
          },
        };
      });

      return {
        attempts: formattedAttempts,
        pagination: result.pagination,
      };
    } catch (error) {
      console.error('Get user attempts error:', error);
      throw error;
    }
  }

  async getUserById(id: string): Promise<IUser | null> {
    return await this.userRepository.findById(id);
  }

  async getUserByEmail(email: string): Promise<IUser | null> {
    return await this.userRepository.findByEmail(email);
  }

  async updateUser(id: string, userData: Partial<IUser>): Promise<IUser | null> {
    return await this.userRepository.update(id, userData);
  }

  async deleteUser(id: string): Promise<boolean> {
    return await this.userRepository.delete(id);
  }

  async getAllUsers(options?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
  }): Promise<{
    users: IUser[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    return await this.userRepository.findAll(options);
  }

  async getAttemptDetails(
    attemptId: string,
    userEmail: string,
  ): Promise<ServiceResult<AttemptDetails>> {
    try {
      // Find user
      const user = await this.userRepository.findByEmail(userEmail);
      const userId = user ? user._id.toString() : userEmail;

      // Get attempt with quiz details
      const attempt = await this.attemptRepository.findByIdWithQuiz(attemptId, userId);

      if (!attempt) {
        return {
          success: false,
          error: 'Attempt not found',
          statusCode: 404,
        };
      }

      const populatedQuiz = attempt.quiz as {
        title?: string;
        slug?: string;
        description?: string;
        questions?: IQuestion[];
      };
      const answers = attempt.answers as (number | number[])[];

      const questions: AttemptQuestionDetail[] = (populatedQuiz.questions ?? []).map(
        (question, index) => {
          const userAnswer = answers[index] ?? -1;
          let isCorrect = false;
          if (question.type === 'single') {
            isCorrect = userAnswer === question.correctIndex;
          } else if (Array.isArray(userAnswer) && Array.isArray(question.correctIndexes)) {
            isCorrect =
              question.correctIndexes.length === userAnswer.length &&
              question.correctIndexes.every((idx) => userAnswer.includes(idx));
          }
          return {
            question: question.question,
            options: question.options,
            type: question.type,
            correctIndex: question.correctIndex,
            correctIndexes: question.correctIndexes,
            questionImage: question.questionImage,
            optionImages: question.optionImages,
            userAnswer,
            isCorrect,
          };
        },
      );

      return {
        success: true,
        data: {
          _id: String(attempt._id),
          score: attempt.score,
          takenAt: attempt.takenAt,
          answers,
          quiz: {
            title: populatedQuiz.title ?? '',
            slug: populatedQuiz.slug ?? '',
            description: populatedQuiz.description ?? '',
            questions,
          },
        },
      };
    } catch (error) {
      console.error('Get attempt details error:', error);
      return {
        success: false,
        error: 'Failed to get attempt details',
        statusCode: 500,
      };
    }
  }
}
