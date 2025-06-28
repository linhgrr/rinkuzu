export interface IAttempt {
  _id?: string
  user: string
  quiz: any
  answers: any[]
  score: number
  totalQuestions: number
  takenAt: Date
  timeSpent?: number
  createdAt?: Date
  updatedAt?: Date
}

export interface IAttemptRepository {
  findById(id: string): Promise<IAttempt | null>
  
  findByUser(userId: string, options?: {
    page?: number
    limit?: number
  }): Promise<{
    attempts: IAttempt[]
    pagination: {
      currentPage: number
      totalPages: number
      totalItems: number
      itemsPerPage: number
      hasNextPage: boolean
      hasPrevPage: boolean
    }
  }>
  
  create(attemptData: Partial<IAttempt>): Promise<IAttempt>
  
  countByUser(userId: string): Promise<number>
  
  countByQuiz(quizId: string): Promise<number>
  
  findRecentActivity(limit?: number): Promise<IAttempt[]>
  
  findByUserId(userId: string, page?: number, limit?: number): Promise<{ attempts: IAttempt[], total: number }>
  
  findByIdWithQuiz(attemptId: string, userId: string): Promise<any>
  
  update(id: string, attemptData: Partial<IAttempt>): Promise<IAttempt | null>
  
  delete(id: string): Promise<boolean>
  
  count(filter: any): Promise<number>
} 