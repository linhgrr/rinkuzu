import connectDB from '@/lib/mongoose'
import User from '@/models/User'
import { IUser } from '@/types/index'
import { IUserRepository } from '@/interfaces/repositories/IUserRepository'

export class UserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<IUser | null> {
    await connectDB()
    return await User.findOne({ email }).lean() as unknown as IUser | null
  }

  async findById(id: string): Promise<IUser | null> {
    await connectDB()
    return await User.findById(id).lean() as unknown as IUser | null
  }

  async create(userData: Partial<IUser>): Promise<IUser> {
    await connectDB()
    const user = new User(userData)
    return await user.save() as unknown as IUser
  }

  async update(id: string, userData: Partial<IUser>): Promise<IUser | null> {
    await connectDB()
    return await User.findByIdAndUpdate(id, userData, { new: true }).lean() as unknown as IUser | null
  }

  async delete(id: string): Promise<boolean> {
    await connectDB()
    const result = await User.findByIdAndDelete(id)
    return !!result
  }

  async findAll(options?: {
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
  }> {
    await connectDB()
    
    const page = options?.page || 1
    const limit = options?.limit || 10
    const skip = (page - 1) * limit

    // Build query
    const query: any = {}
    if (options?.search) {
      query.email = { $regex: options.search, $options: 'i' }
    }
    if (options?.role) {
      query.role = options.role
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean() as unknown as IUser[]

    const totalItems = await User.countDocuments(query)
    const totalPages = Math.ceil(totalItems / limit)

    return {
      users,
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

  async count(): Promise<number> {
    await connectDB()
    return await User.countDocuments()
  }

  async countByRole(): Promise<{ _id: string; count: number }[]> {
    await connectDB()
    return await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ])
  }

  async updateById(id: string, updateData: any): Promise<IUser | null> {
    await connectDB()
    return await User.findByIdAndUpdate(id, updateData, { new: true }).lean() as unknown as IUser | null
  }
} 