import connectDB from '@/lib/mongoose'
import Attempt from '@/models/Attempt'
import { IAttempt, IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository'

export class AttemptRepository implements IAttemptRepository {
  async findById(id: string): Promise<IAttempt | null> {
    await connectDB()
    return await Attempt.findById(id)
      .populate({
        path: 'quiz',
        select: 'title slug description questions'
      })
      .lean()
  }

  async findByUser(userId: string, options?: {
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
  }> {
    await connectDB()
    
    const page = options?.page || 1
    const limit = options?.limit || 10
    const skip = (page - 1) * limit

    console.log('AttemptRepository.findByUser called with userId:', userId, 'page:', page, 'limit:', limit);

    // Try to find attempts by user ID (could be ObjectId or email string)
    let attempts = await Attempt.find({ user: userId })
      .populate({
        path: 'quiz',
        select: 'title slug description questions'
      })
      .sort({ takenAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    console.log('Found attempts with userId:', attempts.length);

    // If no attempts found with userId, try to find by email if userId looks like an email
    if (attempts.length === 0 && userId.includes('@')) {
      console.log('No attempts found with userId, trying with email:', userId);
      attempts = await Attempt.find({ user: userId })
        .populate({
          path: 'quiz',
          select: 'title slug description questions'
        })
        .sort({ takenAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
      console.log('Found attempts with email:', attempts.length);
    }

    const totalItems = await Attempt.countDocuments({ user: userId })
    console.log('Total items for user:', totalItems);
    
    const totalPages = Math.ceil(totalItems / limit)

    return {
      attempts,
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

  async create(attemptData: Partial<IAttempt>): Promise<IAttempt> {
    await connectDB()
    const attempt = new Attempt(attemptData)
    const saved = await attempt.save()
    return saved.toObject()
  }

  async countByUser(userId: string): Promise<number> {
    await connectDB()
    return await Attempt.countDocuments({ user: userId })
  }

  async countByQuiz(quizId: string): Promise<number> {
    await connectDB()
    return await Attempt.countDocuments({ quiz: quizId })
  }

  async findRecentActivity(limit: number = 10): Promise<IAttempt[]> {
    await connectDB()
    return await Attempt.find()
      .populate('quiz', 'title slug')
      .sort({ takenAt: -1 })
      .limit(limit)
      .lean()
  }

  async findByIdWithQuiz(attemptId: string, userId: string): Promise<any> {
    await connectDB()
    return await Attempt.findOne({ 
      _id: attemptId,
      user: userId 
    }).populate({
      path: 'quiz',
      select: 'title slug description questions',
    }).lean()
  }

  async update(id: string, attemptData: Partial<IAttempt>): Promise<IAttempt | null> {
    await connectDB()
    return await Attempt.findByIdAndUpdate(id, attemptData, { new: true }).lean()
  }

  async delete(id: string): Promise<boolean> {
    await connectDB()
    const result = await Attempt.findByIdAndDelete(id)
    return !!result
  }

  async count(filter: any = {}): Promise<number> {
    await connectDB()
    return await Attempt.countDocuments(filter)
  }
} 