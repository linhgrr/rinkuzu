import { NextRequest } from 'next/server';
import { withOptionalAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { quizSlugRouteParamsSchema } from '@/dtos/quiz';

const quizService = serviceFactory.getQuizService();

export const GET = withOptionalAuth(async (_request: NextRequest, { params, userId, session }) => {
  try {
    const parsedParams = readAndValidateRouteParams(params, quizSlugRouteParamsSchema);
    if (!parsedParams.success) {
      return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
    }
    const userRole = session?.user?.role;

    const result = await quizService.getQuizForPlay(
      parsedParams.data.slug,
      userRole,
      userId ?? undefined,
    );

    if (!result.success) {
      return apiServiceErr(result);
    }

    return apiOk(result.data);
  } catch (error: unknown) {
    logger.error({ error }, 'Get quiz for play error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
