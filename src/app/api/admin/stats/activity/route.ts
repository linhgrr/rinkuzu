import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import Quiz from '@/models/Quiz';
import Attempt from '@/models/Attempt';

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
    const type = searchParams.get('type') || 'all'; // all, users, quizzes, attempts
    const days = parseInt(searchParams.get('days') || '30');

    const skip = (page - 1) * limit;
    const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    let data: any = {};
    let total = 0;
    let results: any[] = [];

    if (type === 'all' || type === 'users') {
      const users = await User.find({ createdAt: { $gte: daysAgo } })
        .select('email createdAt role')
        .sort({ createdAt: -1 })
        .skip(type === 'users' ? skip : 0)
        .limit(type === 'users' ? limit : (type === 'all' ? 10 : 0));

      if (type === 'users') {
        const userCount = await User.countDocuments({ createdAt: { $gte: daysAgo } });
        total = userCount;
        results = users.map(user => ({
          type: 'user',
          data: user,
          date: user.createdAt
        }));
      } else if (type === 'all') {
        data.users = users;
      }
    }

    if (type === 'all' || type === 'quizzes') {
      const quizzes = await Quiz.find({ createdAt: { $gte: daysAgo } })
        .populate('author', 'email')
        .populate('category', 'name color')
        .select('title status createdAt author category questions')
        .sort({ createdAt: -1 })
        .skip(type === 'quizzes' ? skip : 0)
        .limit(type === 'quizzes' ? limit : (type === 'all' ? 10 : 0));

      if (type === 'quizzes') {
        const quizCount = await Quiz.countDocuments({ createdAt: { $gte: daysAgo } });
        total = quizCount;
        results = quizzes.map(quiz => ({
          type: 'quiz',
          data: {
            ...quiz.toObject(),
            questionCount: quiz.questions.length
          },
          date: quiz.createdAt
        }));
      } else if (type === 'all') {
        data.quizzes = quizzes.map(quiz => ({
          ...quiz.toObject(),
          questionCount: quiz.questions.length
        }));
      }
    }

    if (type === 'all' || type === 'attempts') {
      const attempts = await Attempt.find({ takenAt: { $gte: daysAgo } })
        .populate('user', 'email')
        .populate('quiz', 'title category')
        .populate({
          path: 'quiz',
          populate: {
            path: 'category',
            select: 'name color'
          }
        })
        .select('score takenAt user quiz answers')
        .sort({ takenAt: -1 })
        .skip(type === 'attempts' ? skip : 0)
        .limit(type === 'attempts' ? limit : (type === 'all' ? 10 : 0));

      if (type === 'attempts') {
        const attemptCount = await Attempt.countDocuments({ takenAt: { $gte: daysAgo } });
        total = attemptCount;
        results = attempts.map(attempt => ({
          type: 'attempt',
          data: {
            ...attempt.toObject(),
            answeredQuestions: attempt.answers.filter(answer => 
              Array.isArray(answer) ? answer.length > 0 : answer !== -1
            ).length
          },
          date: attempt.takenAt
        }));
      } else if (type === 'all') {
        data.attempts = attempts.map(attempt => ({
          ...attempt.toObject(),
          answeredQuestions: attempt.answers.filter(answer => 
            Array.isArray(answer) ? answer.length > 0 : answer !== -1
          ).length
        }));
      }
    }

    // For mixed activity feed (type === 'all' but with pagination)
    if (type === 'mixed') {
      const allActivities: any[] = [];

      // Get users
      const users = await User.find({ createdAt: { $gte: daysAgo } })
        .select('email createdAt role')
        .sort({ createdAt: -1 });
      
      users.forEach(user => {
        allActivities.push({
          type: 'user',
          data: user,
          date: user.createdAt
        });
      });

      // Get quizzes
      const quizzes = await Quiz.find({ createdAt: { $gte: daysAgo } })
        .populate('author', 'email')
        .populate('category', 'name color')
        .select('title status createdAt author category questions')
        .sort({ createdAt: -1 });

      quizzes.forEach(quiz => {
        allActivities.push({
          type: 'quiz',
          data: {
            ...quiz.toObject(),
            questionCount: quiz.questions.length
          },
          date: quiz.createdAt
        });
      });

      // Get attempts
      const attempts = await Attempt.find({ takenAt: { $gte: daysAgo } })
        .populate('user', 'email')
        .populate('quiz', 'title category')
        .populate({
          path: 'quiz',
          populate: {
            path: 'category',
            select: 'name color'
          }
        })
        .select('score takenAt user quiz answers')
        .sort({ takenAt: -1 });

      attempts.forEach(attempt => {
        allActivities.push({
          type: 'attempt',
          data: {
            ...attempt.toObject(),
            answeredQuestions: attempt.answers.filter(answer => 
              Array.isArray(answer) ? answer.length > 0 : answer !== -1
            ).length
          },
          date: attempt.takenAt
        });
      });

      // Sort all activities by date
      allActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      total = allActivities.length;
      results = allActivities.slice(skip, skip + limit);
    }

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: type === 'all' ? data : {
        activities: results,
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
    console.error('Error fetching activity with pagination:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch activity' },
      { status: 500 }
    );
  }
} 