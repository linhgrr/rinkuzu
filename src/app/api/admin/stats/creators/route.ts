import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import Quiz from '@/models/Quiz';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'quizCount'; // quizCount, totalQuestions, joinedAt
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all'; // all, published, pending, rejected

    const skip = (page - 1) * limit;

    // Build aggregation pipeline
    const matchStage: any = {};
    if (status !== 'all') {
      matchStage.status = status;
    }

    const pipeline: any[] = [
      { $match: matchStage },
      {
        $group: {
          _id: '$author',
          quizCount: { $sum: 1 },
          totalQuestions: { $sum: { $size: '$questions' } },
          publishedQuizzes: {
            $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] }
          },
          pendingQuizzes: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          rejectedQuizzes: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
          },
          latestQuizDate: { $max: '$createdAt' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          email: '$user.email',
          role: '$user.role',
          joinedAt: '$user.createdAt',
          quizCount: 1,
          totalQuestions: 1,
          publishedQuizzes: 1,
          pendingQuizzes: 1,
          rejectedQuizzes: 1,
          latestQuizDate: 1,
          successRate: {
            $cond: [
              { $gt: ['$quizCount', 0] },
              { $multiply: [{ $divide: ['$publishedQuizzes', '$quizCount'] }, 100] },
              0
            ]
          }
        }
      }
    ];

    // Add search filter if provided
    if (search) {
      pipeline.push({
        $match: {
          email: { $regex: search, $options: 'i' }
        }
      });
    }

    // Add sorting
    const sortField = sortBy === 'joinedAt' ? 'joinedAt' : sortBy;
    pipeline.push({
      $sort: { [sortField]: sortOrder === 'desc' ? -1 : 1 }
    });

    // Get total count for pagination
    const totalCountPipeline = [...pipeline, { $count: 'total' }];
    const totalResult = await Quiz.aggregate(totalCountPipeline);
    const total = totalResult[0]?.total || 0;

    // Add pagination
    pipeline.push({ $skip: skip }, { $limit: limit });

    const creators = await Quiz.aggregate(pipeline);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        creators,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching creators with stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch creators' },
      { status: 500 }
    );
  }
} 