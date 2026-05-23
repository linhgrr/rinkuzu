import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export const POST = withAuth<{ slug: string }>(
  async (request: NextRequest, { params, email, session }) => {
    try {
      const { slug } = params;
      if (!email) {
        return apiErr('validation_error', 'User email is required', 400);
      }

      const { content } = await request.json();

      if (!content || content.trim().length === 0) {
        return apiErr('validation_error', 'Report content is required', 400);
      }

      if (content.length > 2000) {
        return apiErr('validation_error', 'Report content too long (max 2000 characters)', 400);
      }

      const quizService = serviceFactory.getQuizService();

      const result = await quizService.reportQuiz(
        slug,
        content.trim(),
        email,
        session.user.name || email,
      );

      if (!result.success) {
        return apiServiceErr(result, 400);
      }

      return apiOk({ reportId: result.data }, 200, {
        meta: { message: 'Report submitted successfully' },
      });
    } catch (error) {
      logger.error({ error }, 'Error submitting report');
      return apiErr('internal_error', 'Internal server error', 500);
    }
  },
);
