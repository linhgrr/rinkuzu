import type { Session } from 'next-auth';

import type { ServiceResult } from '@/interfaces/services/types';
import { withOptionalAuth } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { parseQuizSlugRouteParams } from './quiz-slug-route-params';

interface OptionalQuizSlugReadContext {
  slug: string;
  userId: string | null;
  session: Session | null;
}

interface OptionalQuizSlugReadRouteOptions<TData> {
  load: (context: OptionalQuizSlugReadContext) => Promise<ServiceResult<TData>>;
  logMessage: string;
  publicErrorMessage: string;
}

export function createOptionalQuizSlugReadRoute<TData>(
  options: OptionalQuizSlugReadRouteOptions<TData>,
) {
  return withOptionalAuth(async (_request, { params, userId, session }) => {
    try {
      const parsedParams = parseQuizSlugRouteParams(params);
      if (!parsedParams.success) return parsedParams.response;

      const result = await options.load({
        slug: parsedParams.slug,
        userId,
        session,
      });

      return result.success ? apiOk(result.data) : apiServiceErr(result);
    } catch (error) {
      logger.error({ error }, options.logMessage);
      return apiErr('internal_error', options.publicErrorMessage, 500);
    }
  });
}
