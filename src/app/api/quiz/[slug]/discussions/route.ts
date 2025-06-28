import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';

// GET /api/quiz/[slug]/discussions - Get all discussions for a quiz
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const quizService = serviceFactory.getQuizService();
    
    const result = await quizService.getQuizDiscussions(params.slug);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.statusCode || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
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

    const { questionIndex, content } = await request.json();

    if (typeof questionIndex !== 'number' || !content?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Question index and content are required' },
        { status: 400 }
      );
    }

    const quizService = serviceFactory.getQuizService();
    
    const result = await quizService.addDiscussionComment(
      params.slug,
      questionIndex,
      content.trim(),
      session.user.email
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.statusCode || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add comment' },
      { status: 500 }
    );
  }
} 