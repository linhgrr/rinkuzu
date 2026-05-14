import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { AsyncRouteParams } from '@/types/next-route';
import { apiOk, apiErr } from '@/lib/api/response';

export async function POST(request: NextRequest, { params }: AsyncRouteParams<{ slug: string }>) {
  try {
    const [{ slug }, session, payload] = await Promise.all([
      params,
      getServerSession(authOptions),
      request.json(),
    ]);
    const { answers, userEmail } = payload as { answers?: unknown; userEmail?: string };

    if (!answers || !Array.isArray(answers)) {
      return apiErr('invalid_request', 'Answers array is required', 400);
    }

    if (!session?.user?.email && !userEmail) {
      return apiErr('email_required', 'User email is required', 400);
    }

    const quizService = serviceFactory.getQuizService();

    const result = await quizService.submitQuizAttempt(slug, answers, session, userEmail);

    if (!result.success) {
      return apiErr(
        'service_error',
        String(result.error ?? 'Request failed'),
        result.statusCode || 400,
      );
    }

    return apiOk(result.data);
  } catch (error: unknown) {
    console.error('Submit attempt error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}
