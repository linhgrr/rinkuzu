import { NextRequest } from 'next/server';
import { withOptionalAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { readAndValidateJson } from '@/lib/api/request';
import { submitQuizAttemptRequestSchema } from '@/dtos/quiz';

// Public + authenticated dual path: anonymous attempts pass `userEmail` in body.
export const POST = withOptionalAuth<{ slug: string }>(
  async (request: NextRequest, { params, session, email }) => {
    try {
      const { slug } = params;
      const parsedBody = await readAndValidateJson(request, submitQuizAttemptRequestSchema);
      if (!parsedBody.success) {
        return apiErr('validation_error', parsedBody.error, 400, parsedBody.fields);
      }

      if (!email && !parsedBody.data.userEmail) {
        return apiErr('validation_error', 'User email is required', 400);
      }

      const quizService = serviceFactory.getQuizService();

      const result = await quizService.submitQuizAttempt(
        slug,
        parsedBody.data.answers,
        session,
        parsedBody.data.userEmail,
      );

      if (!result.success) {
        return apiServiceErr(result);
      }

      return apiOk(result.data);
    } catch (error: unknown) {
      logger.error({ error }, 'Submit attempt error');
      return apiErr('internal_error', 'Internal server error', 500);
    }
  },
);
