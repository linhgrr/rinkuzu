import { ServiceResult } from '@/interfaces/services/types';
import { IUser } from '@/types/index';

interface FormattedAttempt {
  _id?: string;
  score: number;
  takenAt: Date;
  quiz: {
    title: string;
    slug: string;
    description?: string;
    totalQuestions: number;
  };
}

interface AttemptDetail {
  _id?: string;
  score: number;
  takenAt: Date;
  answers: (number | number[])[];
  quiz: {
    title: string;
    slug: string;
    description?: string;
    questions: Array<{
      question: string;
      options: string[];
      type: 'single' | 'multiple';
      correctIndex?: number;
      correctIndexes?: number[];
      questionImage?: string;
      optionImages?: (string | undefined)[];
      userAnswer: number | number[];
      isCorrect: boolean;
    }>;
  };
}

export interface IUserService {
  getUserAttempts(
    userEmail: string,
    options?: { page?: number; limit?: number },
  ): Promise<{
    attempts: FormattedAttempt[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }>;
  getAttemptDetails(attemptId: string, userEmail: string): Promise<ServiceResult<AttemptDetail>>;

  getUserById(id: string): Promise<IUser | null>;

  getUserByEmail(email: string): Promise<IUser | null>;

  updateUser(id: string, userData: Partial<IUser>): Promise<IUser | null>;

  deleteUser(id: string): Promise<boolean>;

  getAllUsers(options?: {
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
  }>;
}
