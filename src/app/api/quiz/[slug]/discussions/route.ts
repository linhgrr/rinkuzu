import { NextRequest } from 'next/server';
import { withAuth, withOptionalAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';

// GET /api/quiz/[slug]/discussions - Get all discussions for a quiz.
// Public + authenticated dual path: read access is open; service layer
// gates private quizzes.
export const GET = withOptionalAuth<{ slug: string }>(
  async (_request: NextRequest, { params, session }) => {
    try {
      const { slug } = params;
      const quizService = serviceFactory.getQuizService();

      const result = await quizService.getQuizDiscussions(slug, session);

      if (!result.success) {
        return apiServiceErr(result, 400);
      }

      return apiOk(result.data);
    } catch (error) {
      logger.error({ error }, 'Error fetching discussions');
      return apiErr('internal_error', 'Failed to fetch discussions', 500);
    }
  },
);

// POST /api/quiz/[slug]/discussions - Add a new comment to a question
export const POST = withAuth<{ slug: string }>(
  async (request: NextRequest, { params, email, session }) => {
    try {
      const { slug } = params;
      if (!email) {
        return apiErr('unauthorized', 'Authentication required', 401);
      }

      const { questionIndex, content } = await request.json();

      if (typeof questionIndex !== 'number' || !content?.trim()) {
        return apiErr('validation_error', 'Question index and content are required', 400);
      }

      const quizService = serviceFactory.getQuizService();

      const result = await quizService.addDiscussionComment(
        slug,
        questionIndex,
        content.trim(),
        email,
        session,
      );

      if (!result.success) {
        return apiServiceErr(result, 400);
      }

      return apiOk(result.data);
    } catch (error) {
      logger.error({ error }, 'Error adding comment');
      return apiErr('internal_error', 'Failed to add comment', 500);
    }
  },
);
