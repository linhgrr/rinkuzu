import type { Session } from 'next-auth';
import type { NextRequest } from 'next/server';

import { quizIdRouteParamsSchema } from '@/dtos/quiz';
import { withAuth } from '@/lib/api/auth';
import { parseRouteParams } from '@/lib/api/validated';

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
    const parsedParams = parseRouteParams(params, quizIdRouteParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;

    return options.handle({
      request,
      quizId: parsedParams.data.id,
      userId,
      email,
      session,
    });
  });
}
