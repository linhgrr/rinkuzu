import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import Category from '@/models/Category';
import Quiz from '@/models/Quiz';

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
    const sortBy = searchParams.get('sortBy') || 'quizCount'; // quizCount, name, createdAt
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const search = searchParams.get('search') || '';

    const skip = (page - 1) * limit;

    // Build aggregation pipeline
    const pipeline: any[] = [
      {
        $lookup: {
          from: 'quizzes',
          localField: '_id',
          foreignField: 'category',
          as: 'quizzes'
        }
      },
      {
        $project: {
          name: 1,
          description: 1,
          color: 1,
          isActive: 1,
          createdAt: 1,
          totalQuizzes: { $size: '$quizzes' },
          publishedQuizzes: {
            $size: {
              $filter: {
                input: '$quizzes',
                cond: { $eq: ['$$this.status', 'published'] }
              }
            }
          },
          pendingQuizzes: {
            $size: {
              $filter: {
                input: '$quizzes',
                cond: { $eq: ['$$this.status', 'pending'] }
              }
            }
          },
          rejectedQuizzes: {
            $size: {
              $filter: {
                input: '$quizzes',
                cond: { $eq: ['$$this.status', 'rejected'] }
              }
            }
          },
          totalQuestions: {
            $sum: {
              $map: {
                input: '$quizzes',
                as: 'quiz',
                in: { $size: '$$quiz.questions' }
              }
            }
          }
        }
      }
    ];

    // Add search filter if provided
    if (search) {
      pipeline.push({
        $match: {
          name: { $regex: search, $options: 'i' }
        }
      });
    }

    // Add sorting
    const sortField = sortBy === 'quizCount' ? 'totalQuizzes' : sortBy;
    pipeline.push({
      $sort: { [sortField]: sortOrder === 'desc' ? -1 : 1 }
    });

    // Get total count for pagination
    const totalCountPipeline = [...pipeline, { $count: 'total' }];
    const totalResult = await Category.aggregate(totalCountPipeline);
    const total = totalResult[0]?.total || 0;

    // Add pagination
    pipeline.push({ $skip: skip }, { $limit: limit });

    const categories = await Category.aggregate(pipeline);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        categories,
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
    console.error('Error fetching categories with stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
} 