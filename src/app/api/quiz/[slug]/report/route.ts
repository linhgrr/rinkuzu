import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { readAndValidateJson, readAndValidateRouteParams } from '@/lib/api/request';
import { quizSlugRouteParamsSchema, reportQuizRequestSchema } from '@/dtos/quiz';

export const POST = withAuth(async (request: NextRequest, { params, email, session }) => {
  try {
    const parsedParams = readAndValidateRouteParams(params, quizSlugRouteParamsSchema);
    if (!parsedParams.success) {
      return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
    }
    if (!email) {
      return apiErr('validation_error', 'User email is required', 400);
    }

    const parsedBody = await readAndValidateJson(request, reportQuizRequestSchema);
    if (!parsedBody.success) {
      return apiErr('validation_error', parsedBody.error, 400, parsedBody.fields);
    }

    const quizService = serviceFactory.getQuizService();

    const result = await quizService.reportQuiz(
      parsedParams.data.slug,
      parsedBody.data.content,
      email,
      session.user.name || email,
    );

    if (!result.success) {
      return apiServiceErr(result);
    }

    return apiOk(result.data, 200, {
      meta: { message: 'Report submitted successfully' },
    });
  } catch (error) {
    logger.error({ error }, 'Error submitting report');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
