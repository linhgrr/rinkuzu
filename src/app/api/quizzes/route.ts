import { NextRequest } from 'next/server';
import { withAuth, withOptionalAuth } from '@/lib/api/auth';
import { getQuizService } from '@/lib/quiz-factory';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { readAndValidateJson, readAndValidateSearchParams } from '@/lib/api/request';
import { createQuizRequestSchema, quizListQuerySchema } from '@/dtos/quiz';
import { QuizCreationError } from '@/lib/quiz/errors';
import { UNFILED_FOLDER_TARGET } from '@/shared/constants/folder';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { premiumQuizErrorResponse } from '@/lib/api/premium-quiz';

const quizService = getQuizService();

// GET /api/quizzes - List compact quiz metadata with filtering.
// Personal source content remains protected by the play/attempt service guard.
export const GET = withOptionalAuth(async (request: NextRequest, { session, userId }) => {
  try {
    const isGuest = !session?.user;
    const query = readAndValidateSearchParams(request, quizListQuerySchema);
    if (!query.success) {
      return apiErr('validation_error', query.error, 400, { fields: query.fields });
    }

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
    const input = await readAndValidateJson(request, createQuizRequestSchema);
    if (!input.success) {
      return apiErr('validation_error', input.error, 400, input.fields);
    }
    const premiumService = getPremiumQuizService();
    if (input.data.submitToPremium) {
      await premiumService.assertCanContribute(userId);
    }

    const quiz = await quizService.createQuiz(userId, input.data);

    if (input.data.submitToPremium) {
      await premiumService.createSubmission(userId, {
        quizId: quiz.id,
        rightsAttested: true,
      });
    }

    return apiOk(quiz, 201, {
      meta: { message: 'Quiz created successfully' },
    });
  } catch (error: unknown) {
    logger.error({ error }, 'Create quiz error');
    if (error instanceof Error && error.name === 'PremiumQuizError') {
      return premiumQuizErrorResponse(error);
    }
    if (error instanceof QuizCreationError) {
      const status = error.code === 'premium_required' ? 403 : 400;
      const code = error.code === 'premium_required' ? 'premium_required' : 'validation_error';
      return apiErr(code, error.message, status);
    }

    return apiErr('internal_error', 'Internal server error', 500);
  }
});
