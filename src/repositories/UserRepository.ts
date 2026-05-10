import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import { IUser } from '@/types/index';
import { buildPaginationMeta } from '@/repositories/pagination';
import { BaseRepository } from '@/repositories/base';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';

export class UserRepository extends BaseRepository<IUser> implements IUserRepository {
  constructor() {
    super(User);
  }

  async findByEmail(email: string): Promise<IUser | null> {
    await connectDB();
    return (await User.findOne({ email }).lean()) as unknown as IUser | null;
  }

  async findAll(options?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
  }): Promise<{
    users: IUser[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    await connectDB();

    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const skip = (page - 1) * limit;

    // Build query
    const query: any = {};
    if (options?.search) {
      query.email = { $regex: options.search, $options: 'i' };
    }
    if (options?.role) {
      query.role = options.role;
    }

    const users = (await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()) as unknown as IUser[];

    const totalItems = await User.countDocuments(query);

    return {
      users,
      pagination: buildPaginationMeta(page, limit, totalItems),
    };
  }

  async countByRole(): Promise<{ _id: string; count: number }[]> {
    await connectDB();
    return await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]);
  }

  async findExpiredSubscriptionUsers(): Promise<IUser[]> {
    await connectDB();
    return (await User.find({
      'subscription.isActive': true,
      'subscription.endDate': { $exists: true, $lte: new Date() },
    })
      .select('_id subscription')
      .lean()) as unknown as IUser[];
  }

  async updateById(id: string, updateData: any): Promise<IUser | null> {
    await connectDB();
    return (await User.findByIdAndUpdate(id, updateData, {
      new: true,
    }).lean()) as unknown as IUser | null;
  }
}
