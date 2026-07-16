import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { readAndValidateJson, readAndValidateRouteParams } from '@/lib/api/request';
import { addDiscussionCommentRequestSchema, quizSlugRouteParamsSchema } from '@/dtos/quiz';
import { createOptionalQuizSlugReadRoute } from '@/app/api/quiz/[slug]/optional-read-route';

// GET /api/quiz/[slug]/discussions - Get all discussions for a quiz.
// Public + authenticated dual path: read access is open; service layer
// gates private quizzes.
export const GET = createOptionalQuizSlugReadRoute({
  load: ({ slug, session }) => serviceFactory.getQuizService().getQuizDiscussions(slug, session),
  logMessage: 'Error fetching discussions',
  publicErrorMessage: 'Failed to fetch discussions',
});

// POST /api/quiz/[slug]/discussions - Add a new comment to a question
export const POST = withAuth(async (request: NextRequest, { params, email, session }) => {
  try {
    const parsedParams = readAndValidateRouteParams(params, quizSlugRouteParamsSchema);
    if (!parsedParams.success) {
      return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
    }
    if (!email) {
      return apiErr('unauthorized', 'Authentication required', 401);
    }

    const parsedBody = await readAndValidateJson(request, addDiscussionCommentRequestSchema);
    if (!parsedBody.success) {
      return apiErr('validation_error', parsedBody.error, 400, parsedBody.fields);
    }

    const quizService = serviceFactory.getQuizService();

    const result = await quizService.addDiscussionComment(
      parsedParams.data.slug,
      parsedBody.data.questionIndex,
      parsedBody.data.content,
      email,
      session,
    );

    if (!result.success) {
      return apiServiceErr(result);
    }

    return apiOk(result.data);
  } catch (error) {
    logger.error({ error }, 'Error adding comment');
    return apiErr('internal_error', 'Failed to add comment', 500);
  }
});
