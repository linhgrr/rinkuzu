import { IBookmark } from '@/interfaces/repositories/IBookmarkRepository'

export interface CreateBookmarkRequest {
  quiz: {
    _id: string
    slug: string
    title: string
  }
  question: any
  questionIndex: number
}

export interface IBookmarkService {
  getBookmarksByUser(userEmail: string, options?: {
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
  
  createBookmark(userEmail: string, bookmarkData: CreateBookmarkRequest): Promise<IBookmark>
  
  deleteBookmark(bookmarkId: string): Promise<boolean>
  
  deleteBookmarkByUser(bookmarkId: string, userEmail: string): Promise<boolean>
} 