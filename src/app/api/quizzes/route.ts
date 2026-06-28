import { NextRequest } from 'next/server';
import { withAuth, withOptionalAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const quizService = serviceFactory.getQuizService();

// GET /api/quizzes - List quizzes with filtering.
// Public + authenticated dual path: anonymous callers see only public quizzes.
export const GET = withOptionalAuth(async (request: NextRequest, { session, userId }) => {
  try {
    const isGuest = !session?.user;
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || undefined;
    const folderParam = url.searchParams.get('folder');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const mine = url.searchParams.get('mine');
    const compact = url.searchParams.get('compact') === 'true';
    const visibility = url.searchParams.get('visibility');
    const onlyMine = !isGuest && mine !== null && mine !== 'false';
    const isAdmin = session?.user?.role === 'admin';

    const result = await quizService.getQuizzes({
      search,
      folder:
        onlyMine && folderParam !== null
          ? folderParam === 'null' || folderParam === 'default'
            ? null
            : folderParam
          : undefined,
      page,
      limit,
      isPrivate:
        isGuest || (!onlyMine && !isAdmin)
          ? false
          : visibility === 'private'
            ? true
            : visibility === 'public'
              ? false
              : undefined,
      userRole: session?.user?.role,
      userId: userId ?? undefined,
      onlyMine,
      compact,
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
    const { title, description, folderId, questions, isPrivate, pdfUrl } = await request.json();

    const quiz = await quizService.createQuiz(userId, {
      title,
      description,
      folderId,
      questions,
      isPrivate,
      pdfUrl,
    });

    return apiOk(quiz, 201, {
      meta: { message: 'Quiz created successfully' },
    });
  } catch (error: unknown) {
    logger.error({ error }, 'Create quiz error');
    const message = error instanceof Error ? error.message : '';

    if (
      message.includes('Title and questions are required') ||
      message.includes('Invalid folder selected') ||
      message.includes('Premium subscription required to create private quizzes') ||
      message.includes('Question') ||
      message.includes('Type must be')
    ) {
      return apiErr('validation_error', message, 400);
    }

    return apiErr('internal_error', 'Internal server error', 500);
  }
});
