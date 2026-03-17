import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { AsyncRouteParams } from '@/types/next-route';

const quizService = serviceFactory.getQuizService();

export async function GET(
  request: NextRequest,
  { params }: AsyncRouteParams<{ slug: string }>
) {
  try {
    const { slug } = await params;
    const session = await getServerSession(authOptions);
    
    const userRole = (session?.user as any)?.role;
    const userId = (session?.user as any)?.id;

    const result = await quizService.getQuizForPlay(slug, userRole, userId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.statusCode || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data
    });

  } catch (error: any) {
    console.error('Get quiz for play error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}