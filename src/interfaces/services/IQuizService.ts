import { IQuiz } from '@/interfaces/repositories/IQuizRepository'

export interface CreateQuizRequest {
  title: string
  description?: string
  category: string
  questions: any[]
  isPrivate: boolean
}

export interface QuizListOptions {
  status?: string
  search?: string
  category?: string
  page?: number
  limit?: number
  userRole?: string
  userId?: string
}

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export interface IQuizService {
  getQuizzes(options: QuizListOptions): Promise<{
    quizzes: IQuiz[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }>
  
  createQuiz(userId: string, quizData: CreateQuizRequest): Promise<IQuiz>
  
  getQuizById(id: string, userEmail?: string, userRole?: string): Promise<ServiceResult<any>>
  
  getQuizBySlug(slug: string): Promise<IQuiz | null>
  
  getQuizForPlay(slug: string, userRole?: string, userId?: string): Promise<any>
  
  updateQuiz(id: string, quizData: any, userEmail: string, userRole?: string): Promise<ServiceResult<any>>
  
  deleteQuiz(id: string, userEmail: string, userRole?: string): Promise<ServiceResult<boolean>>
  
  approveQuiz(id: string): Promise<ServiceResult<any>>
  
  rejectQuiz(id: string, reason?: string): Promise<ServiceResult<any>>
  
  submitQuizAttempt(slug: string, answers: any[], session: any, userEmail?: string): Promise<ServiceResult<any>>
  
  getQuizDiscussions(slug: string): Promise<ServiceResult<any[]>>
  
  addDiscussionComment(slug: string, questionIndex: number, content: string, userEmail: string): Promise<ServiceResult<any>>
  
  getQuizForFlashcards(slug: string, session: any): Promise<ServiceResult<any>>
  
  reportQuiz(slug: string, content: string, reporterEmail: string, reporterName: string): Promise<ServiceResult<string>>
  
  previewFromPdf(title: string, description: string, pdfFiles: File[]): Promise<ServiceResult<any>>
} 