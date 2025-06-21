import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import Attempt from '@/models/Attempt';
import User from '@/models/User';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    await connectDB();

    // Find user
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Get pagination parameters from URL
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalAttempts = await Attempt.countDocuments({ user: user._id });

    // Get user's attempts with quiz details
    const attempts = await Attempt.find({ user: user._id })
      .populate({
        path: 'quiz',
        select: 'title slug description questions',
      })
      .sort({ takenAt: -1 })
      .skip(skip)
      .limit(limit);

    const formattedAttempts = attempts.map(attempt => ({
      _id: attempt._id,
      score: attempt.score,
      takenAt: attempt.takenAt,
      quiz: {
        title: attempt.quiz.title,
        slug: attempt.quiz.slug,
        description: attempt.quiz.description,
        totalQuestions: attempt.quiz.questions.length,
      },
    }));

    return NextResponse.json({
      success: true,
      data: formattedAttempts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalAttempts / limit),
        totalItems: totalAttempts,
        itemsPerPage: limit,
        hasNextPage: page < Math.ceil(totalAttempts / limit),
        hasPrevPage: page > 1,
      },
    });

  } catch (error: any) {
    console.error('Get user attempts error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 