import type { Session } from 'next-auth';
import type { ZodType } from 'zod';

import { quizSlugRouteParamsSchema } from '@/dtos/quiz';
import type { ServiceResult } from '@/interfaces/services/types';
import { withAuth } from '@/lib/api/auth';
import { readAndValidateJson, readAndValidateRouteParams } from '@/lib/api/request';
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
      const parsedParams = readAndValidateRouteParams(params, quizSlugRouteParamsSchema);
      if (!parsedParams.success) {
        return apiErr('validation_error', parsedParams.error, 400, {
          fields: parsedParams.fields,
        });
      }
      const parsedBody = await readAndValidateJson(request, options.schema);
      if (!parsedBody.success) {
        return apiErr('validation_error', parsedBody.error, 400, parsedBody.fields);
      }

      const result = await options.execute({
        slug: parsedParams.data.slug,
        input: parsedBody.data,
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
