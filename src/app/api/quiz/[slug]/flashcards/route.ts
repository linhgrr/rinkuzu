import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { AsyncRouteParams } from '@/types/next-route';

export async function GET(
  request: NextRequest,
  { params }: AsyncRouteParams<{ slug: string }>
) {
  try {
    const { slug } = await params;
    const session = await getServerSession(authOptions);
    const quizService = serviceFactory.getQuizService();
    
    const result = await quizService.getQuizForFlashcards(
      slug,
      session
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.statusCode || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data
    });

  } catch (error: any) {
    console.error('Get flashcard quiz error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}