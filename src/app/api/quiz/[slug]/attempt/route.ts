import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { AsyncRouteParams } from '@/types/next-route';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';

// Public + authenticated dual path: anonymous attempts pass `userEmail` in body.
//
const _authOptions = authOptions;

export async function POST(request: NextRequest, { params }: AsyncRouteParams<{ slug: string }>) {
  try {
    const [{ slug }, session, payload] = await Promise.all([
      params,
      getServerSession(_authOptions),
      request.json(),
    ]);
    const { answers, userEmail } = payload as { answers?: unknown; userEmail?: string };

    if (!answers || !Array.isArray(answers)) {
      return apiErr('validation_error', 'Answers array is required', 400);
    }

    if (!session?.user?.email && !userEmail) {
      return apiErr('validation_error', 'User email is required', 400);
    }

    const quizService = serviceFactory.getQuizService();

    const result = await quizService.submitQuizAttempt(
      slug,
      answers as (number | number[])[],
      session,
      userEmail,
    );

    if (!result.success) {
      return apiServiceErr(result, 400);
    }

    return apiOk(result.data);
  } catch (error: unknown) {
    console.error('Submit attempt error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}
