import { NextRequest } from 'next/server';
import type { z } from 'zod';
import { withAuth, withOptionalAuth } from '@/lib/api/auth';
import { getQuizService } from '@/lib/quiz-factory';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { createQuizRequestSchema, quizListQuerySchema, type QuizListDto } from '@/dtos/quiz';
import { catalogCacheHeaders } from '@/lib/http/cache-headers';
import { UNFILED_FOLDER_TARGET } from '@/shared/constants/folder';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { quizAuthoringErrorResponse } from '@/lib/api/quiz-authoring-error';
import { parseJsonBody, parseSearchParams } from '@/lib/api/validated';

const quizService = getQuizService();

type QuizListQuery = z.infer<typeof quizListQuerySchema>;

function listResponse(result: QuizListDto, readsSession: boolean) {
  return apiOk({ quizzes: result.quizzes, pagination: result.pagination }, 200, {
    headers: catalogCacheHeaders({ readsSession }),
  });
}

// The community list (no `mine`) is the same for every visitor: build it
// without reading the session so the CDN can share it (RIN-1644).
async function listPublicQuizzes(query: QuizListQuery): Promise<Response> {
  const result = await quizService.getQuizzes({
    ...(query.search !== undefined ? { search: query.search } : {}),
    page: query.page,
    limit: query.limit,
    onlyMine: false,
  });
  return listResponse(result, false);
}

const listOwnQuizzes = withOptionalAuth(async (request: NextRequest, { session, userId }) => {
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

    // `?mine=true` URLs carry per-user data for signed-in callers: never shared.
    return listResponse(result, true);
  } catch (error: unknown) {
    logger.error({ error }, 'Get quizzes error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

// GET /api/quizzes - List compact quiz metadata with filtering.
// Personal source content remains protected by the play/attempt service guard.
export async function GET(
  request: NextRequest,
  routeContext: { params: Promise<Record<string, string | string[]>> },
): Promise<Response> {
  const query = parseSearchParams(request, quizListQuerySchema);
  if (!query.ok) return query.response;
  if (query.data.mine) return listOwnQuizzes(request, routeContext);
  try {
    return await listPublicQuizzes(query.data);
  } catch (error: unknown) {
    logger.error({ error }, 'Get quizzes error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
}

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
