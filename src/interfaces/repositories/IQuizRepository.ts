export interface IQuiz {
  _id?: string
  title: string
  description?: string
  slug: string
  author: string
  category: string
  questions: any[]
  status: 'pending' | 'published' | 'rejected'
  isPrivate: boolean
  tags?: string[]
  createdAt?: Date
  updatedAt?: Date
}

export interface IQuizRepository {
  findById(id: string): Promise<IQuiz | null>
  
  findBySlug(slug: string): Promise<IQuiz | null>
  
  findBySlugAndStatus(slug: string, status: string): Promise<IQuiz | null>
  
  create(quizData: Partial<IQuiz>): Promise<IQuiz>
  
  update(id: string, quizData: Partial<IQuiz>): Promise<IQuiz | null>
  
  delete(id: string): Promise<boolean>
  
  findAll(filter?: any, options?: {
    page?: number
    limit?: number
    sort?: any
    populate?: string[]
  }): Promise<{
    quizzes: IQuiz[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }>
  
  findForPlay(slug: string): Promise<IQuiz | null>
  
  findUserQuizzes(userId: string, options?: {
    page?: number
    limit?: number
    status?: string
  }): Promise<{
    quizzes: IQuiz[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }>
  
  count(filter?: any): Promise<number>
  
  countByStatus(): Promise<{ _id: string; count: number }[]>
  
  countByCategory(): Promise<{ _id: string; count: number }[]>
  
  findRecentQuizzes(limit?: number): Promise<IQuiz[]>
  
  updateStatus(id: string, status: string, reviewNote?: string): Promise<IQuiz | null>
} 