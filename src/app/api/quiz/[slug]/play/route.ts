import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { AsyncRouteParams } from '@/types/next-route';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';

const quizService = serviceFactory.getQuizService();

// Public + authenticated dual path: anonymous players still need quiz data,
// auth shapes only access to private quizzes (handled inside the service).
//
const _authOptions = authOptions;

export async function GET(_request: NextRequest, { params }: AsyncRouteParams<{ slug: string }>) {
  try {
    const { slug } = await params;
    const session = await getServerSession(_authOptions);

    const userRole = session?.user?.role;
    const userId = session?.user?.id;

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
