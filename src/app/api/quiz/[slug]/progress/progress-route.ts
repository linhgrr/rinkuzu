import type { NextRequest } from 'next/server';

import { withAuth } from '@/lib/api/auth';
import { apiErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { quizSlugRouteParamsSchema } from '@/dtos/quiz';
import { parseRouteParams } from '@/lib/api/validated';

interface QuizProgressRouteContext {
  request: NextRequest;
  slug: string;
  userId: string;
  userRole?: string;
}

interface QuizProgressRouteOptions {
  handle: (context: QuizProgressRouteContext) => Promise<Response>;
  logMessage: string;
}

export function createQuizProgressRoute(options: QuizProgressRouteOptions) {
  return withAuth(async (request: NextRequest, { params, userId, session }) => {
    try {
      const parsedParams = parseRouteParams(params, quizSlugRouteParamsSchema);
      if (!parsedParams.ok) return parsedParams.response;

      return await options.handle({
        request,
        slug: parsedParams.data.slug,
        userId,
        userRole: session.user.role,
      });
    } catch (error) {
      logger.error({ error }, options.logMessage);
      return apiErr('internal_error', 'Internal server error', 500);
    }
  });
}
