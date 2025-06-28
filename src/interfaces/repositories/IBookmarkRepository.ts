export interface IBookmark {
  _id?: string
  userId: string
  userEmail: string
  quiz: {
    _id: string
    slug: string
    title: string
  }
  question: any
  questionIndex: number
  createdAt?: Date
  updatedAt?: Date
}

export interface IBookmarkRepository {
  findByUserEmail(userEmail: string, options?: {
    page?: number
    limit?: number
  }): Promise<{
    bookmarks: IBookmark[]
    pagination: {
      currentPage: number
      totalPages: number
      totalItems: number
      itemsPerPage: number
      hasNextPage: boolean
      hasPrevPage: boolean
    }
  }>
  
  findByUserAndQuiz(userEmail: string, quizSlug: string, questionIndex: number): Promise<IBookmark | null>
  
  create(bookmarkData: Partial<IBookmark>): Promise<IBookmark>
  
  deleteById(id: string): Promise<boolean>
  
  deleteByIdAndUser(id: string, userEmail: string): Promise<boolean>
  
  count(userEmail: string): Promise<number>
} 