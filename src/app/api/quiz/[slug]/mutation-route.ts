import type { Session } from 'next-auth';
import type { ZodType } from 'zod';

import { quizSlugRouteParamsSchema } from '@/dtos/quiz';
import type { ServiceResult } from '@/interfaces/services/types';
import { withAuth } from '@/lib/api/auth';
import { parseParamsAndBody } from '@/lib/api/validated';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';

type AuthenticatedSession = Session & { user: NonNullable<Session['user']> };

interface QuizSlugMutationContext<TInput> {
  slug: string;
  input: TInput;
  email: string;
  session: AuthenticatedSession;
}

interface QuizSlugMutationRouteOptions<TInput, TData> {
  schema: ZodType<TInput>;
  execute: (context: QuizSlugMutationContext<TInput>) => Promise<ServiceResult<TData>>;
  successMeta?: Record<string, unknown>;
  logMessage: string;
  publicErrorMessage: string;
}

export function createQuizSlugMutationRoute<TInput, TData>(
  options: QuizSlugMutationRouteOptions<TInput, TData>,
) {
  return withAuth(async (request, { params, email, session }) => {
    try {
      const parsed = await parseParamsAndBody(request, params, {
        params: quizSlugRouteParamsSchema,
        body: options.schema,
      });
      if (!parsed.ok) return parsed.response;

      const result = await options.execute({
        slug: parsed.params.slug,
        input: parsed.body,
        email,
        session,
      });
      return result.success
        ? apiOk(
            result.data,
            200,
            options.successMeta === undefined ? undefined : { meta: options.successMeta },
          )
        : apiServiceErr(result);
    } catch (error) {
      logger.error({ error }, options.logMessage);
      return apiErr('internal_error', options.publicErrorMessage, 500);
    }
  });
}
