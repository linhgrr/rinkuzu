import { NextRequest } from 'next/server';
import { withOptionalAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { quizSlugRouteParamsSchema } from '@/dtos/quiz';

export const GET = withOptionalAuth(async (_request: NextRequest, { params, session }) => {
  try {
    const parsedParams = readAndValidateRouteParams(params, quizSlugRouteParamsSchema);
    if (!parsedParams.success) {
      return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
    }
    const quizService = serviceFactory.getQuizService();

    const result = await quizService.getQuizForFlashcards(parsedParams.data.slug, session);

    if (!result.success) {
      return apiServiceErr(result);
    }

    return apiOk(result.data);
  } catch (error: unknown) {
    logger.error({ error }, 'Get flashcard quiz error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
