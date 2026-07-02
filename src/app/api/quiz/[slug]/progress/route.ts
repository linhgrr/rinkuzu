import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { readAndValidateJson, readAndValidateRouteParams } from '@/lib/api/request';
import { quizSlugRouteParamsSchema, savedQuizProgressSchema } from '@/dtos/quiz';

const quizService = serviceFactory.getQuizService();

export const GET = withAuth(async (_request: NextRequest, { params, userId }) => {
  try {
    const parsedParams = readAndValidateRouteParams(params, quizSlugRouteParamsSchema);
    if (!parsedParams.success) {
      return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
    }

    const result = await quizService.getSavedQuizProgress(parsedParams.data.slug, userId);

    return result.success ? apiOk(result.data) : apiServiceErr(result);
  } catch (error) {
    logger.error({ error }, 'Get quiz progress error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

export const PUT = withAuth(async (request: NextRequest, { params, userId }) => {
  try {
    const parsedParams = readAndValidateRouteParams(params, quizSlugRouteParamsSchema);
    if (!parsedParams.success) {
      return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
    }

    const parsedBody = await readAndValidateJson(request, savedQuizProgressSchema);
    if (!parsedBody.success) {
      return apiErr('validation_error', parsedBody.error, 400, parsedBody.fields);
    }

    const result = await quizService.saveQuizProgress(
      parsedParams.data.slug,
      userId,
      parsedBody.data,
    );

    return result.success ? apiOk(result.data) : apiServiceErr(result);
  } catch (error) {
    logger.error({ error }, 'Save quiz progress error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

export const DELETE = withAuth(async (_request: NextRequest, { params, userId }) => {
  try {
    const parsedParams = readAndValidateRouteParams(params, quizSlugRouteParamsSchema);
    if (!parsedParams.success) {
      return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
    }

    const result = await quizService.deleteSavedQuizProgress(parsedParams.data.slug, userId);

    return result.success ? apiOk(result.data) : apiServiceErr(result);
  } catch (error) {
    logger.error({ error }, 'Delete quiz progress error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
