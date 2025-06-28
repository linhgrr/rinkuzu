import { IBookmarkService, CreateBookmarkRequest } from '@/interfaces/services/IBookmarkService'
import { IBookmarkRepository, IBookmark } from '@/interfaces/repositories/IBookmarkRepository'

export class BookmarkService implements IBookmarkService {
  constructor(private bookmarkRepository: IBookmarkRepository) {}

  async getBookmarksByUser(userEmail: string, options?: {
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
  }> {
    return await this.bookmarkRepository.findByUserEmail(userEmail, options)
  }

  async createBookmark(userEmail: string, bookmarkData: CreateBookmarkRequest): Promise<IBookmark> {
    const { quiz, question, questionIndex } = bookmarkData

    // Check if bookmark already exists
    const existingBookmark = await this.bookmarkRepository.findByUserAndQuiz(
      userEmail,
      quiz.slug,
      questionIndex
    )

    if (existingBookmark) {
      throw new Error('Question already bookmarked')
    }

    return await this.bookmarkRepository.create({
      userId: userEmail,
      userEmail,
      quiz,
      question,
      questionIndex
    })
  }

  async deleteBookmark(bookmarkId: string): Promise<boolean> {
    return await this.bookmarkRepository.deleteById(bookmarkId)
  }

  async deleteBookmarkByUser(bookmarkId: string, userEmail: string): Promise<boolean> {
    const result = await this.bookmarkRepository.deleteByIdAndUser(bookmarkId, userEmail)
    if (!result) {
      throw new Error('Bookmark not found or unauthorized')
    }
    return result
  }
} 