import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongoose';
import Quiz from '@/models/Quiz';
import { authOptions } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    await connectDB();

    const quiz = await Quiz.findById(params.id);
    if (!quiz) {
      return NextResponse.json(
        { success: false, error: 'Quiz not found' },
        { status: 404 }
      );
    }

    if (quiz.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Only pending quizzes can be approved' },
        { status: 400 }
      );
    }

    quiz.status = 'published';
    await quiz.save();

    return NextResponse.json({
      success: true,
      message: 'Quiz approved and published successfully',
      data: quiz
    });

  } catch (error: any) {
    console.error('Approve quiz error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 