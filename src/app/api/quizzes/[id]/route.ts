import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { readAndValidateJson } from '@/lib/api/request';
import { updateQuizRequestSchema } from '@/dtos/quiz';
import { createQuizIdRoute } from './quiz-id-route';

// GET /api/quizzes/[id] - Get specific quiz
export const GET = createQuizIdRoute({
  handle: async ({ quizId, email, userId, session }) => {
    try {
      if (!email) {
        return apiErr('validation_error', 'User email is required', 400);
      }

      const quizService = serviceFactory.getQuizService();
      const result = await quizService.getQuizById(quizId, email, session.user.role, userId);

      if (!result.success) {
        return apiServiceErr(result);
      }

      const data = result.data;

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
  },
});

// PUT /api/quizzes/[id] - Update quiz (only author or admin)
export const PUT = createQuizIdRoute({
  handle: async ({ request, quizId, userId, session }) => {
    try {
      const input = await readAndValidateJson(request, updateQuizRequestSchema);
      if (!input.success) {
        return apiErr('validation_error', input.error, 400, input.fields);
      }
      const quizService = serviceFactory.getQuizService();

      const result = await quizService.updateQuiz(quizId, input.data, userId, session.user.role);

      if (!result.success) {
        return apiServiceErr(result);
      }

      return apiOk(result.data);
    } catch (error: unknown) {
      logger.error({ error }, 'Update quiz error');
      return apiErr('internal_error', 'Internal server error', 500);
    }
  },
});

// DELETE /api/quizzes/[id] - Delete quiz (only author or admin)
export const DELETE = createQuizIdRoute({
  handle: async ({ quizId, userId, session }) => {
    try {
      const quizService = serviceFactory.getQuizService();
      const result = await quizService.deleteQuiz(quizId, userId, session.user.role);

      if (!result.success) {
        return apiServiceErr(result);
      }

      return apiOk(result.data, 200, { meta: { message: 'Quiz deleted successfully' } });
    } catch (error: unknown) {
      logger.error({ error }, 'Delete quiz error');
      return apiErr('internal_error', 'Internal server error', 500);
    }
  },
});
