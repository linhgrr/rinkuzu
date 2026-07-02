import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { readAndValidateJson } from '@/lib/api/request';
import { savedQuizProgressSchema } from '@/dtos/quiz';

const quizService = serviceFactory.getQuizService();

export const GET = withAuth<{ slug: string }>(async (_request: NextRequest, { params, userId }) => {
  try {
    const result = await quizService.getSavedQuizProgress(params.slug, userId);

    return result.success ? apiOk(result.data) : apiServiceErr(result);
  } catch (error) {
    logger.error({ error }, 'Get quiz progress error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

export const PUT = withAuth<{ slug: string }>(async (request: NextRequest, { params, userId }) => {
  try {
    const parsedBody = await readAndValidateJson(request, savedQuizProgressSchema);
    if (!parsedBody.success) {
      return apiErr('validation_error', parsedBody.error, 400, parsedBody.fields);
    }

    const result = await quizService.saveQuizProgress(params.slug, userId, parsedBody.data);

    return result.success ? apiOk(result.data) : apiServiceErr(result);
  } catch (error) {
    logger.error({ error }, 'Save quiz progress error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

export const DELETE = withAuth<{ slug: string }>(
  async (_request: NextRequest, { params, userId }) => {
    try {
      const result = await quizService.deleteSavedQuizProgress(params.slug, userId);

      return result.success ? apiOk(result.data) : apiServiceErr(result);
    } catch (error) {
      logger.error({ error }, 'Delete quiz progress error');
      return apiErr('internal_error', 'Internal server error', 500);
    }
  },
);
