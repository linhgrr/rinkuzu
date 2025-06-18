import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongoose';
import Quiz from '@/models/Quiz';
import Attempt from '@/models/Attempt';
import { authOptions } from '@/lib/auth';

// GET /api/quizzes/[id] - Get specific quiz
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const quiz = await Quiz.findById(params.id).populate('author', 'email');

    if (!quiz) {
      return NextResponse.json(
        { success: false, error: 'Quiz not found' },
        { status: 404 }
      );
    }

    // Check authorization
    const isAdmin = (session.user as any).role === 'admin';
    const isAuthor = quiz.author._id.toString() === (session.user as any).id;

    if (!isAdmin && !isAuthor && quiz.status !== 'published') {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: quiz
    });

  } catch (error: any) {
    console.error('Get quiz error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/quizzes/[id] - Update quiz (only author or admin)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { title, description } = await request.json();

    await connectDB();

    const quiz = await Quiz.findById(params.id);
    if (!quiz) {
      return NextResponse.json(
        { success: false, error: 'Quiz not found' },
        { status: 404 }
      );
    }

    // Check permissions
    const isAdmin = (session.user as any).role === 'admin';
    const isAuthor = quiz.author.toString() === (session.user as any).id;

    if (!isAdmin && !isAuthor) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Only allow editing if status is pending or rejected
    if (quiz.status === 'published' && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Cannot edit published quiz' },
        { status: 400 }
      );
    }

    // Update quiz
    if (title) quiz.title = title;
    if (description !== undefined) quiz.description = description;
    
    await quiz.save();

    return NextResponse.json({
      success: true,
      data: quiz
    });

  } catch (error: any) {
    console.error('Update quiz error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/quizzes/[id] - Delete quiz
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
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

    // Check authorization - only author or admin can delete
    const isAdmin = (session.user as any).role === 'admin';
    const isAuthor = quiz.author.toString() === (session.user as any).id;

    if (!isAdmin && !isAuthor) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Only quiz author or admin can delete.' },
        { status: 403 }
      );
    }

    // Check if quiz has attempts
    const attemptCount = await Attempt.countDocuments({ quiz: params.id });
    
    if (attemptCount > 0 && !isAdmin) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot delete quiz. It has ${attemptCount} attempt(s). Only admin can delete quizzes with attempts.` 
        },
        { status: 400 }
      );
    }

    // If admin is deleting quiz with attempts, also delete the attempts
    if (attemptCount > 0 && isAdmin) {
      await Attempt.deleteMany({ quiz: params.id });
      console.log(`🗑️ Admin deleted ${attemptCount} attempts for quiz ${params.id}`);
    }

    // Delete the quiz
    await Quiz.findByIdAndDelete(params.id);

    console.log(`🗑️ Quiz deleted: ${quiz.title} by ${session.user?.email}`);

    return NextResponse.json({
      success: true,
      message: attemptCount > 0 
        ? `Quiz and ${attemptCount} attempts deleted successfully`
        : 'Quiz deleted successfully'
    });

  } catch (error: any) {
    console.error('Delete quiz error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 