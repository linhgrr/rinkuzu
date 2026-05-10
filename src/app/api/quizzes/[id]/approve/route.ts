import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { AsyncRouteParams } from '@/types/next-route';
import { apiErr } from '@/lib/api/response';

export async function POST(request: NextRequest, { params }: AsyncRouteParams<{ id: string }>) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return apiErr('forbidden', 'Admin access required', 403);
    }

    const quizService = serviceFactory.getQuizService();

    const result = await quizService.approveQuiz(id);

    if (!result.success) {
      return apiErr('service_error', result.error ?? 'Request failed', result.statusCode || 400);
    }

    return NextResponse.json({
      success: true,
      message: 'Quiz approved and published successfully',
      data: result.data,
    });
  } catch (error: any) {
    console.error('Approve quiz error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}
