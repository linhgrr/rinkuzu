import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { AsyncRouteParams } from '@/types/next-route';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';

export async function POST(request: NextRequest, { params }: AsyncRouteParams<{ id: string }>) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return apiErr('forbidden', 'Admin access required', 403);
    }

    const { reason } = await request.json();
    const quizService = serviceFactory.getQuizService();

    const result = await quizService.rejectQuiz(id, reason);

    if (!result.success) {
      return apiServiceErr(result, 400);
    }

    return apiOk(result.data, 200, { meta: { message: 'Quiz rejected successfully' } });
  } catch (error: any) {
    console.error('Reject quiz error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}
