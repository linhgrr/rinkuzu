import connectDB from '@/lib/mongoose'
import Bookmark from '@/models/Bookmark'
import { IBookmark, IBookmarkRepository } from '@/interfaces/repositories/IBookmarkRepository'

export class BookmarkRepository implements IBookmarkRepository {
  async findByUserEmail(userEmail: string, options?: {
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
    await connectDB()
    
    const page = options?.page || 1
    const limit = options?.limit || 10
    const skip = (page - 1) * limit

    const bookmarks = await Bookmark.find({ userEmail })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean() as unknown as IBookmark[]

    const totalItems = await Bookmark.countDocuments({ userEmail })
    const totalPages = Math.ceil(totalItems / limit)

    return {
      bookmarks,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }
  }

  async findByUserAndQuiz(userEmail: string, quizSlug: string, questionIndex: number): Promise<IBookmark | null> {
    await connectDB()
    return await Bookmark.findOne({
      userEmail,
      'quiz.slug': quizSlug,
      questionIndex
    }).lean() as unknown as IBookmark | null
  }

  async create(bookmarkData: Partial<IBookmark>): Promise<IBookmark> {
    await connectDB()
    const bookmark = new Bookmark(bookmarkData)
    return await bookmark.save() as unknown as IBookmark
  }

  async deleteById(id: string): Promise<boolean> {
    await connectDB()
    const result = await Bookmark.findByIdAndDelete(id)
    return !!result
  }

  async deleteByIdAndUser(id: string, userEmail: string): Promise<boolean> {
    await connectDB()
    const result = await Bookmark.findOneAndDelete({
      _id: id,
      userEmail
    })
    return !!result
  }

  async count(userEmail: string): Promise<number> {
    await connectDB()
    return await Bookmark.countDocuments({ userEmail })
  }
} 