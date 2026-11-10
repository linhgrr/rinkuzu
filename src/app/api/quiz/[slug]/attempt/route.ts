import { NextRequest } from 'next/server';
import { withOptionalAuth } from '@/lib/api/auth';
import { getQuizService } from '@/lib/quiz-factory';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { parseParamsAndBody } from '@/lib/api/validated';
import { quizSlugRouteParamsSchema, submitQuizAttemptRequestSchema } from '@/dtos/quiz';
import { resolveQuizEntryAttribution } from '@/shared/constants/starter-quiz';

// Public + authenticated dual path. Anonymous attempts pass a `guestClaimToken`
// (RIN-912; only its hash is stored); a body email identifies no one (RIN-921).
export const POST = withOptionalAuth(async (request: NextRequest, { params, session, email }) => {
  try {
    const parsed = await parseParamsAndBody(request, params, {
      params: quizSlugRouteParamsSchema,
      body: submitQuizAttemptRequestSchema,
    });
    if (!parsed.ok) return parsed.response;

    const { guestClaimToken } = parsed.body;
    if (!session?.user?.id && !email && !guestClaimToken) {
      return apiErr('validation_error', 'User identification required', 400);
    }

    const quizService = getQuizService();
    // RIN-1256: an untracked entry or a malformed post or topic is dropped, never a 400.
    const attribution = resolveQuizEntryAttribution(
      parsed.body.entry,
      parsed.body.post,
      parsed.body.topic,
    );

    const result = await quizService.submitQuizAttempt(
      parsed.params.slug,
      parsed.body.answers,
      parsed.body.idempotencyKey,
      session,
      parsed.body.retryOfAttemptId,
      guestClaimToken,
      parsed.body.mode === 'quick' ? parsed.body.questionIndices : undefined,
      attribution.entry === undefined ? undefined : attribution,
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
