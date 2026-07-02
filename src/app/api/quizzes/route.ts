import { NextRequest } from 'next/server';
import { withAuth, withOptionalAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { readAndValidateJson, readAndValidateSearchParams } from '@/lib/api/request';
import { createQuizRequestSchema, quizListQuerySchema } from '@/dtos/quiz';
import { QuizDetailDtoMapper } from '@/mappers/quiz/QuizDetailDtoMapper';
import { QuizCreationError } from '@/lib/quiz/errors';
import { UNFILED_FOLDER_TARGET } from '@/shared/constants/folder';

const quizService = serviceFactory.getQuizService();

// GET /api/quizzes - List quizzes with filtering.
// Public + authenticated dual path: anonymous callers see only public quizzes.
export const GET = withOptionalAuth(async (request: NextRequest, { session, userId }) => {
  try {
    const isGuest = !session?.user;
    const query = readAndValidateSearchParams(request, quizListQuerySchema);
    if (!query.success) {
      return apiErr('validation_error', query.error, 400, { fields: query.fields });
    }

    const onlyMine = !isGuest && query.data.mine;
    const isAdmin = session?.user?.role === 'admin';

    const result = await quizService.getQuizzes({
      search: query.data.search,
      folder:
        onlyMine && query.data.folder !== undefined
          ? query.data.folder === UNFILED_FOLDER_TARGET
            ? null
            : query.data.folder
          : undefined,
      page: query.data.page,
      limit: query.data.limit,
      isPrivate:
        isGuest || (!onlyMine && !isAdmin)
          ? false
          : query.data.visibility === 'private'
            ? true
            : query.data.visibility === 'public'
              ? false
              : undefined,
      userRole: session?.user?.role,
      userId: userId ?? undefined,
      onlyMine,
      compact: query.data.compact,
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

    const quiz = await quizService.createQuiz(userId, input.data);

    return apiOk(QuizDetailDtoMapper.toDetail(quiz), 201, {
      meta: { message: 'Quiz created successfully' },
    });
  } catch (error: unknown) {
    logger.error({ error }, 'Create quiz error');
    if (error instanceof QuizCreationError) {
      const status = error.code === 'premium_required' ? 403 : 400;
      const code = error.code === 'premium_required' ? 'forbidden' : 'validation_error';
      return apiErr(code, error.message, status);
    }

    return apiErr('internal_error', 'Internal server error', 500);
  }
});
