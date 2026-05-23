import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import type { IQuiz } from '@/interfaces/repositories/IQuizRepository';
import { logger } from '@/lib/logger';

// GET /api/quizzes/[id] - Get specific quiz
export const GET = withAuth<{ id: string }>(async (_request, { params, email, session }) => {
  try {
    const { id } = params;
    if (!email) {
      return apiErr('validation_error', 'User email is required', 400);
    }

    const quizService = serviceFactory.getQuizService();
    const result = await quizService.getQuizById(id, email, session.user.role);

    if (!result.success) {
      return apiServiceErr(result, 400);
    }

    const data: IQuiz | undefined = result.data;

    // Refresh signed URL if PDF exists
    if (data?.pdfUrl) {
      try {
        const { getSignedPDFUrl, BUCKET_NAME } = await import('@/lib/s3');
        const pdfUrl = data.pdfUrl;
        const marker = `${BUCKET_NAME}/`;

        if (pdfUrl.includes(marker)) {
          const key = pdfUrl.split(marker)[1];
          if (key) {
            data.pdfUrl = await getSignedPDFUrl(key);
          }
        }
      } catch (error) {
        logger.error({ error }, 'Failed to refresh signed URL for quiz');
      }
    }

    return apiOk(data);
  } catch (error: unknown) {
    logger.error({ error }, 'Get quiz error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

// PUT /api/quizzes/[id] - Update quiz (only author or admin)
export const PUT = withAuth<{ id: string }>(
  async (request: NextRequest, { params, email, session }) => {
    try {
      const { id } = params;
      if (!email) {
        return apiErr('validation_error', 'User email is required', 400);
      }

      const quizData = await request.json();
      const quizService = serviceFactory.getQuizService();

      const result = await quizService.updateQuiz(id, quizData, email, session.user.role);

      if (!result.success) {
        return apiServiceErr(result, 400);
      }

      return apiOk(result.data);
    } catch (error: unknown) {
      logger.error({ error }, 'Update quiz error');
      return apiErr('internal_error', 'Internal server error', 500);
    }
  },
);

// DELETE /api/quizzes/[id] - Delete quiz (only author or admin)
export const DELETE = withAuth<{ id: string }>(async (_request, { params, email, session }) => {
  try {
    const { id } = params;
    if (!email) {
      return apiErr('validation_error', 'User email is required', 400);
    }

    const quizService = serviceFactory.getQuizService();
    const result = await quizService.deleteQuiz(id, email, session.user.role);

    if (!result.success) {
      return apiServiceErr(result, 400);
    }

    return apiOk(null, 200, { meta: { message: 'Quiz deleted successfully' } });
  } catch (error: unknown) {
    logger.error({ error }, 'Delete quiz error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
