import { NextRequest } from 'next/server';
import { withAuth, withOptionalAuth } from '@/lib/api/auth';
import { getQuizService } from '@/lib/quiz-factory';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { createQuizRequestSchema, quizListQuerySchema } from '@/dtos/quiz';
import { UNFILED_FOLDER_TARGET } from '@/shared/constants/folder';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { quizAuthoringErrorResponse } from '@/lib/api/quiz-authoring-error';
import { parseJsonBody, parseSearchParams } from '@/lib/api/validated';

const quizService = getQuizService();

// GET /api/quizzes - List compact quiz metadata with filtering.
// Personal source content remains protected by the play/attempt service guard.
export const GET = withOptionalAuth(async (request: NextRequest, { session, userId }) => {
  try {
    const isGuest = !session?.user;
    const query = parseSearchParams(request, quizListQuerySchema);
    if (!query.ok) return query.response;

    const onlyMine = !isGuest && query.data.mine;
    const folder =
      onlyMine && query.data.folder !== undefined
        ? query.data.folder === UNFILED_FOLDER_TARGET
          ? null
          : query.data.folder
        : undefined;
    const result = await quizService.getQuizzes({
      ...(query.data.search !== undefined ? { search: query.data.search } : {}),
      ...(folder !== undefined ? { folder } : {}),
      page: query.data.page,
      limit: query.data.limit,
      ...(onlyMine && query.data.visibility !== undefined
        ? { visibility: query.data.visibility }
        : {}),
      ...(typeof userId === 'string' ? { userId } : {}),
      onlyMine,
    });

    return apiOk({
      quizzes: result.quizzes,
      pagination: result.pagination,
    });
  } catch (error: unknown) {
    logger.error({ error }, 'Get quizzes error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

// POST /api/quizzes - Create quiz from prepared data
export const POST = withAuth(async (request: NextRequest, { userId }) => {
  try {
    const input = await parseJsonBody(request, createQuizRequestSchema);
    if (!input.ok) return input.response;
    const premiumService = getPremiumQuizService();
    if (input.data.submitToPremium) {
      await premiumService.assertCanContribute(userId);
    }

    const quiz = await quizService.createQuiz(userId, input.data);

    if (input.data.submitToPremium) {
      await premiumService.submitSavedQuiz(userId, {
        quizId: quiz.id,
        rightsAttested: true,
      });
    }

    return apiOk(quiz, 201, {
      meta: { message: 'Quiz created successfully' },
    });
  } catch (error: unknown) {
    logger.error({ error }, 'Create quiz error');
    return (
      quizAuthoringErrorResponse(error) ?? apiErr('internal_error', 'Internal server error', 500)
    );
  }
});
