import connectDB from '@/lib/mongoose'
import Quiz from '@/models/Quiz'
import { IQuiz, IQuizRepository } from '@/interfaces/repositories/IQuizRepository'

export class QuizRepository implements IQuizRepository {
  async findById(id: string): Promise<IQuiz | null> {
    await connectDB()
    return await Quiz.findById(id)
      .populate('author', 'email')
      .populate('category', 'name color')
      .lean()
  }

  async findBySlug(slug: string): Promise<IQuiz | null> {
    await connectDB()
    return await Quiz.findOne({ slug })
      .populate('author', 'email')
      .populate('category', 'name color')
      .lean()
  }

  async findBySlugAndStatus(slug: string, status: string): Promise<IQuiz | null> {
    await connectDB()
    return await Quiz.findOne({ slug, status })
      .populate('author', 'email')
      .lean()
  }

  async create(quizData: Partial<IQuiz>): Promise<IQuiz> {
    await connectDB()
    const quiz = new Quiz(quizData)
    return await quiz.save()
  }

  async update(id: string, quizData: Partial<IQuiz>): Promise<IQuiz | null> {
    await connectDB()
    return await Quiz.findByIdAndUpdate(id, quizData, { new: true })
      .populate('author', 'email')
      .populate('category', 'name color')
      .lean()
  }

  async delete(id: string): Promise<boolean> {
    await connectDB()
    const result = await Quiz.findByIdAndDelete(id)
    return !!result
  }

  async findAll(filter: any = {}, options: {
    page?: number
    limit?: number
    sort?: any
    populate?: string[]
  } = {}): Promise<{
    quizzes: IQuiz[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }> {
    await connectDB()
    
    const page = options.page || 1
    const limit = options.limit || 10
    const skip = (page - 1) * limit
    const sort = options.sort || { createdAt: -1 }

    let query = Quiz.find(filter)
    
    if (options.populate?.includes('author')) {
      query = query.populate('author', 'email')
    }
    if (options.populate?.includes('category')) {
      query = query.populate('category', 'name color')
    }

    const [quizzes, total] = await Promise.all([
      query.sort(sort).skip(skip).limit(limit).lean(),
      Quiz.countDocuments(filter)
    ])

    return {
      quizzes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  async findForPlay(slug: string): Promise<IQuiz | null> {
    await connectDB()
    return await Quiz.findOne({ 
      slug, 
      status: 'published' 
    }).populate('author', 'email').lean()
  }

  async findUserQuizzes(userId: string, options: {
    page?: number
    limit?: number
    status?: string
  } = {}): Promise<{
    quizzes: IQuiz[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }> {
    await connectDB()
    
    const page = options.page || 1
    const limit = options.limit || 10
    const skip = (page - 1) * limit
    
    const filter: any = { author: userId }
    if (options.status) {
      filter.status = options.status
    }

    const [quizzes, total] = await Promise.all([
      Quiz.find(filter)
        .populate('category', 'name color')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Quiz.countDocuments(filter)
    ])

    return {
      quizzes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  async count(filter: any = {}): Promise<number> {
    await connectDB()
    return await Quiz.countDocuments(filter)
  }

  async countByStatus(): Promise<{ _id: string; count: number }[]> {
    await connectDB()
    return await Quiz.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ])
  }

  async countByCategory(): Promise<{ _id: string; count: number }[]> {
    await connectDB()
    return await Quiz.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      }
    ])
  }

  async findRecentQuizzes(limit: number = 10): Promise<IQuiz[]> {
    await connectDB()
    return await Quiz.find({ status: 'published' })
      .populate('author', 'email')
      .populate('category', 'name color')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
  }

  async updateStatus(id: string, status: string, reviewNote?: string): Promise<IQuiz | null> {
    await connectDB()
    const updateData: any = { status }
    if (reviewNote) {
      updateData.reviewNote = reviewNote
    }
    return await Quiz.findByIdAndUpdate(id, updateData, { new: true }).lean()
  }
} 