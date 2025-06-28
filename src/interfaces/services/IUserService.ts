import { IUser } from '@/types/index'
import { IAttempt } from '@/interfaces/repositories/IAttemptRepository'

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export interface IUserService {
  getUserAttempts(userEmail: string, options?: { page?: number, limit?: number }): Promise<{
    attempts: any[]
    pagination: {
      currentPage: number
      totalPages: number
      totalItems: number
      itemsPerPage: number
      hasNextPage: boolean
      hasPrevPage: boolean
    }
  }>;
  getAttemptDetails(attemptId: string, userEmail: string): Promise<ServiceResult<any>>;

  getUserById(id: string): Promise<IUser | null>
  
  getUserByEmail(email: string): Promise<IUser | null>
  
  updateUser(id: string, userData: Partial<IUser>): Promise<IUser | null>
  
  deleteUser(id: string): Promise<boolean>
  
  getAllUsers(options?: {
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
  }>
} 