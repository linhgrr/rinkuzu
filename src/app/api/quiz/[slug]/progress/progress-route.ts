import type { NextRequest } from 'next/server';

import { quizSlugRouteParamsSchema } from '@/dtos/quiz';
import { withAuth } from '@/lib/api/auth';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { apiErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';

interface QuizProgressRouteContext {
  request: NextRequest;
  slug: string;
  userId: string;
}

interface QuizProgressRouteOptions {
  handle: (context: QuizProgressRouteContext) => Promise<Response>;
  logMessage: string;
}

export function createQuizProgressRoute(options: QuizProgressRouteOptions) {
  return withAuth(async (request: NextRequest, { params, userId }) => {
    try {
      const parsedParams = readAndValidateRouteParams(params, quizSlugRouteParamsSchema);
      if (!parsedParams.success) {
        return apiErr('validation_error', parsedParams.error, 400, {
          fields: parsedParams.fields,
        });
      }

      return await options.handle({ request, slug: parsedParams.data.slug, userId });
    } catch (error) {
      logger.error({ error }, options.logMessage);
      return apiErr('internal_error', 'Internal server error', 500);
    }
  });
}
