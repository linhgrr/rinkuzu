import type { Session } from 'next-auth';
import type { NextRequest } from 'next/server';

import { quizIdRouteParamsSchema } from '@/dtos/quiz';
import { withAuth } from '@/lib/api/auth';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { apiErr } from '@/lib/api/response';

type AuthenticatedSession = Session & {
  user: NonNullable<Session['user']>;
};

interface QuizIdRouteContext {
  request: NextRequest;
  quizId: string;
  userId: string;
  email: string;
  session: AuthenticatedSession;
}

interface QuizIdRouteOptions {
  handle: (context: QuizIdRouteContext) => Promise<Response>;
}

/**
 * Shared auth + quiz id route-param boundary for GET/PUT/DELETE on /api/quizzes/[id].
 * Preserves validation response shape (400 + fields) before invoking the method handler.
 */
export function createQuizIdRoute(options: QuizIdRouteOptions) {
  return withAuth(async (request: NextRequest, { params, userId, email, session }) => {
    const parsedParams = readAndValidateRouteParams(params, quizIdRouteParamsSchema);
    if (!parsedParams.success) {
      return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
    }

    return options.handle({
      request,
      quizId: parsedParams.data.id,
      userId,
      email,
      session,
    });
  });
}
