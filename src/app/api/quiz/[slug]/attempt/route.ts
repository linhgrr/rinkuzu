import { NextRequest } from 'next/server';
import { withOptionalAuth } from '@/lib/api/auth';
import { getQuizService } from '@/lib/quiz-factory';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { parseParamsAndBody } from '@/lib/api/validated';
import { quizSlugRouteParamsSchema, submitQuizAttemptRequestSchema } from '@/dtos/quiz';

// Public + authenticated dual path: anonymous attempts pass `userEmail` in body.
export const POST = withOptionalAuth(async (request: NextRequest, { params, session, email }) => {
  try {
    const parsed = await parseParamsAndBody(request, params, {
      params: quizSlugRouteParamsSchema,
      body: submitQuizAttemptRequestSchema,
    });
    if (!parsed.ok) return parsed.response;

    if (!session?.user?.id && !email && !parsed.body.userEmail) {
      return apiErr('validation_error', 'User email is required', 400);
    }

    const quizService = getQuizService();

    const result = await quizService.submitQuizAttempt(
      parsed.params.slug,
      parsed.body.answers,
      parsed.body.idempotencyKey,
      session,
      parsed.body.userEmail,
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
