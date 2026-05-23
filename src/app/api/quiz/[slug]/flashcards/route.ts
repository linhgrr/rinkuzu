import { NextRequest } from 'next/server';
import { withOptionalAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export const GET = withOptionalAuth<{ slug: string }>(
  async (_request: NextRequest, { params, session }) => {
    try {
      const { slug } = params;
      const quizService = serviceFactory.getQuizService();

      const result = await quizService.getQuizForFlashcards(slug, session);

      if (!result.success) {
        return apiServiceErr(result, 400);
      }

      return apiOk(result.data);
    } catch (error: unknown) {
      logger.error({ error }, 'Get flashcard quiz error');
      return apiErr('internal_error', 'Internal server error', 500);
    }
  },
);
