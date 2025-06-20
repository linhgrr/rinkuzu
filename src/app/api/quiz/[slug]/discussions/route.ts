import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import Quiz from '@/models/Quiz';
import Discussion from '@/models/Discussion';
import User from '@/models/User';

// GET /api/quiz/[slug]/discussions - Get all discussions for a quiz
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    await connectDB();

    const quiz = await Quiz.findOne({ slug: params.slug });
    if (!quiz) {
      return NextResponse.json(
        { success: false, error: 'Quiz not found' },
        { status: 404 }
      );
    }

    const discussions = await Discussion.find({ quiz: quiz._id })
      .populate('comments.author', 'email')
      .sort({ questionIndex: 1, 'comments.createdAt': 1 });

    return NextResponse.json({
      success: true,
      data: discussions,
    });
  } catch (error) {
    console.error('Error fetching discussions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch discussions' },
      { status: 500 }
    );
  }
}

// POST /api/quiz/[slug]/discussions - Add a new comment to a question
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    await connectDB();

    const { questionIndex, content } = await request.json();

    if (typeof questionIndex !== 'number' || !content?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Question index and content are required' },
        { status: 400 }
      );
    }

    const quiz = await Quiz.findOne({ slug: params.slug });
    if (!quiz) {
      return NextResponse.json(
        { success: false, error: 'Quiz not found' },
        { status: 404 }
      );
    }

    if (questionIndex < 0 || questionIndex >= quiz.questions.length) {
      return NextResponse.json(
        { success: false, error: 'Invalid question index' },
        { status: 400 }
      );
    }

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Find or create discussion for this question
    let discussion = await Discussion.findOne({
      quiz: quiz._id,
      questionIndex,
    });

    if (!discussion) {
      discussion = new Discussion({
        quiz: quiz._id,
        questionIndex,
        comments: [],
      });
    }

    // Add the new comment
    discussion.comments.push({
      author: user._id,
      authorEmail: user.email,
      content: content.trim(),
      isEdited: false,
    } as any);

    await discussion.save();

    // Populate the author info for the response
    await discussion.populate('comments.author', 'email');

    return NextResponse.json({
      success: true,
      data: discussion,
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add comment' },
      { status: 500 }
    );
  }
} 