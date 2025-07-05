import { IUser } from '@/types/index'

export interface IUserRepository {
  findByEmail(email: string): Promise<IUser | null>
  findById(id: string): Promise<IUser | null>
  create(userData: Partial<IUser>): Promise<IUser>
  update(id: string, userData: Partial<IUser>): Promise<IUser | null>
  delete(id: string): Promise<boolean>
  findAll(options?: {
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
  count(): Promise<number>
  countByRole(): Promise<{ _id: string; count: number }[]>
  updateById(id: string, updateData: any): Promise<IUser | null>
} 