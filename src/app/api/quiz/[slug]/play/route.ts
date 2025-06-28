import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';

const quizService = serviceFactory.getQuizService();

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    const userRole = (session?.user as any)?.role;
    const userId = (session?.user as any)?.id;

    const quiz = await quizService.getQuizForPlay(params.slug, userRole, userId);

    return NextResponse.json({
      success: true,
      data: quiz
    });

  } catch (error: any) {
    console.error('Get quiz for play error:', error);

    if (error.message === 'Quiz not found or not published') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }

    if (error.message === 'Access denied. This quiz is private.') {
        return NextResponse.json(
        { success: false, error: error.message },
          { status: 403 }
        );
      }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 