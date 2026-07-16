import { NextRequest } from 'next/server';
import { withOptionalAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { readAndValidateJson, readAndValidateRouteParams } from '@/lib/api/request';
import { quizSlugRouteParamsSchema, submitQuizAttemptRequestSchema } from '@/dtos/quiz';

// Public + authenticated dual path: anonymous attempts pass `userEmail` in body.
export const POST = withOptionalAuth(async (request: NextRequest, { params, session, email }) => {
  try {
    const parsedParams = readAndValidateRouteParams(params, quizSlugRouteParamsSchema);
    if (!parsedParams.success) {
      return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
    }
    const parsedBody = await readAndValidateJson(request, submitQuizAttemptRequestSchema);
    if (!parsedBody.success) {
      return apiErr('validation_error', parsedBody.error, 400, parsedBody.fields);
    }

    if (!session?.user?.id && !email && !parsedBody.data.userEmail) {
      return apiErr('validation_error', 'User email is required', 400);
    }

    const quizService = serviceFactory.getQuizService();

    const result = await quizService.submitQuizAttempt(
      parsedParams.data.slug,
      parsedBody.data.answers,
      parsedBody.data.idempotencyKey,
      session,
      parsedBody.data.userEmail,
    );

    if (!result.success) {
      return apiServiceErr(result);
    }

    return apiOk(result.data);
  } catch (error: unknown) {
    logger.error({ error }, 'Submit attempt error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
