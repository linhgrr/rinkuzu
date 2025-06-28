import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import Quiz from '@/models/Quiz';
import Attempt from '@/models/Attempt';
import Category from '@/models/Category';

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

    // Get current date for time-based statistics
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Basic counts
    const [
      totalUsers,
      totalAdmins,
      totalQuizzes,
      publishedQuizzes,
      pendingQuizzes,
      rejectedQuizzes,
      totalAttempts,
      totalCategories,
      activeCategories
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'admin' }),
      Quiz.countDocuments(),
      Quiz.countDocuments({ status: 'published' }),
      Quiz.countDocuments({ status: 'pending' }),
      Quiz.countDocuments({ status: 'rejected' }),
      Attempt.countDocuments(),
      Category.countDocuments(),
      Category.countDocuments({ isActive: true })
    ]);

    // Time-based statistics
    const [
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      newQuizzesToday,
      newQuizzesThisWeek,
      newQuizzesThisMonth,
      attemptsToday,
      attemptsThisWeek,
      attemptsThisMonth
    ] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: today } }),
      User.countDocuments({ createdAt: { $gte: thisWeek } }),
      User.countDocuments({ createdAt: { $gte: thisMonth } }),
      Quiz.countDocuments({ createdAt: { $gte: today } }),
      Quiz.countDocuments({ createdAt: { $gte: thisWeek } }),
      Quiz.countDocuments({ createdAt: { $gte: thisMonth } }),
      Attempt.countDocuments({ takenAt: { $gte: today } }),
      Attempt.countDocuments({ takenAt: { $gte: thisWeek } }),
      Attempt.countDocuments({ takenAt: { $gte: thisMonth } })
    ]);

    // Top categories by quiz count
    const topCategories = await Quiz.aggregate([
      { $match: { status: 'published' } },
      {
        $group: {
          _id: '$category',
          quizCount: { $sum: 1 },
          totalQuestions: { $sum: { $size: '$questions' } }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: '$category' },
      { $sort: { quizCount: -1 } },
      { $limit: 10 },
      {
        $project: {
          name: '$category.name',
          color: '$category.color',
          quizCount: 1,
          totalQuestions: 1
        }
      }
    ]);

    // Top quiz creators
    const topCreators = await Quiz.aggregate([
      { $match: { status: 'published' } },
      {
        $group: {
          _id: '$author',
          quizCount: { $sum: 1 },
          totalQuestions: { $sum: { $size: '$questions' } }
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
      { $sort: { quizCount: -1 } },
      { $limit: 10 },
      {
        $project: {
          email: '$user.email',
          quizCount: 1,
          totalQuestions: 1
        }
      }
    ]);

    // Quiz statistics by category
    const categoryStats = await Category.aggregate([
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
          color: 1,
          isActive: 1,
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
          }
        }
      },
      { $sort: { totalQuizzes: -1 } }
    ]);

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const recentActivity = await Promise.all([
      User.find({ createdAt: { $gte: thirtyDaysAgo } })
        .select('email createdAt')
        .sort({ createdAt: -1 })
        .limit(10),
      Quiz.find({ createdAt: { $gte: thirtyDaysAgo } })
        .populate('author', 'email')
        .populate('category', 'name')
        .select('title status createdAt author category')
        .sort({ createdAt: -1 })
        .limit(10),
      Attempt.find({ takenAt: { $gte: thirtyDaysAgo } })
        .populate('quiz', 'title')
        .select('score takenAt user quiz')
        .sort({ takenAt: -1 })
        .limit(10)
    ]);

    // Average scores
    const avgScores = await Attempt.aggregate([
      {
        $group: {
          _id: null,
          averageScore: { $avg: '$score' },
          highestScore: { $max: '$score' },
          lowestScore: { $min: '$score' }
        }
      }
    ]);

    // Growth trends (last 12 months)
    const growthData = await Promise.all([
      // User growth
      User.aggregate([
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 12 }
      ]),
      // Quiz growth
      Quiz.aggregate([
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 12 }
      ]),
      // Attempt growth
      Attempt.aggregate([
        {
          $group: {
            _id: {
              year: { $year: '$takenAt' },
              month: { $month: '$takenAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 12 }
      ])
    ]);

    const stats = {
      overview: {
        totalUsers,
        totalAdmins,
        totalQuizzes,
        publishedQuizzes,
        pendingQuizzes,
        rejectedQuizzes,
        totalAttempts,
        totalCategories,
        activeCategories
      },
      timeBasedStats: {
        today: {
          newUsers: newUsersToday,
          newQuizzes: newQuizzesToday,
          attempts: attemptsToday
        },
        thisWeek: {
          newUsers: newUsersThisWeek,
          newQuizzes: newQuizzesThisWeek,
          attempts: attemptsThisWeek
        },
        thisMonth: {
          newUsers: newUsersThisMonth,
          newQuizzes: newQuizzesThisMonth,
          attempts: attemptsThisMonth
        }
      },
      topCategories,
      topCreators,
      categoryStats,
      recentActivity: {
        users: recentActivity[0],
        quizzes: recentActivity[1],
        attempts: recentActivity[2]
      },
      scoreStats: avgScores[0] || { averageScore: 0, highestScore: 0, lowestScore: 0 },
      growthTrends: {
        users: growthData[0],
        quizzes: growthData[1],
        attempts: growthData[2]
      }
    };

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
} 