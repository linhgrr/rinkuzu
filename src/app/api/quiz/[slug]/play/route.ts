import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { AsyncRouteParams } from '@/types/next-route';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';

const quizService = serviceFactory.getQuizService();

export async function GET(request: NextRequest, { params }: AsyncRouteParams<{ slug: string }>) {
  try {
    const { slug } = await params;
    const session = await getServerSession(authOptions);

    const userRole = (session?.user as { role?: string })?.role;
    const userId = (session?.user as { id?: string })?.id;

    const result = await quizService.getQuizForPlay(slug, userRole, userId);

    if (!result.success) {
      return apiServiceErr(result, 500);
    }

    return apiOk(result.data);
  } catch (error: unknown) {
    console.error('Get quiz for play error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}
