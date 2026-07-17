import type { NextRequest } from 'next/server';

import { withAuth } from '@/lib/api/auth';
import { apiErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { parseQuizSlugRouteParams } from '../quiz-slug-route-params';

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
      const parsedParams = parseQuizSlugRouteParams(params);
      if (!parsedParams.success) return parsedParams.response;

      return await options.handle({
        request,
        slug: parsedParams.slug,
        userId,
        userRole: session.user.role,
      });
    } catch (error) {
      logger.error({ error }, options.logMessage);
      return apiErr('internal_error', 'Internal server error', 500);
    }
  });
}
