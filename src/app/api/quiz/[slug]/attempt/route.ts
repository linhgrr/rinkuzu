import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const { answers, userEmail } = await request.json();

    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json(
        { success: false, error: 'Answers array is required' },
        { status: 400 }
      );
    }

    // For non-logged in users, require email
    if (!session?.user?.email && !userEmail) {
      return NextResponse.json(
        { success: false, error: 'User email is required' },
        { status: 400 }
      );
    }

    const quizService = serviceFactory.getQuizService();
    
    const result = await quizService.submitQuizAttempt(
      params.slug,
      answers,
      session,
      userEmail
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
    console.error('Submit attempt error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 