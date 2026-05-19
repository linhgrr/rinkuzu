import { NextRequest } from 'next/server';
import { withOptionalAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';

// Public + authenticated dual path: anonymous attempts pass `userEmail` in body.
export const POST = withOptionalAuth<{ slug: string }>(
  async (request: NextRequest, { params, session, email }) => {
    try {
      const { slug } = params;
      const payload = await request.json();
      const { answers, userEmail } = payload as { answers?: unknown; userEmail?: string };

      if (!answers || !Array.isArray(answers)) {
        return apiErr('validation_error', 'Answers array is required', 400);
      }

      if (!email && !userEmail) {
        return apiErr('validation_error', 'User email is required', 400);
      }

      const quizService = serviceFactory.getQuizService();

      const result = await quizService.submitQuizAttempt(
        slug,
        answers as (number | number[])[],
        session,
        userEmail,
      );

      if (!result.success) {
        return apiServiceErr(result, 400);
      }

      return apiOk(result.data);
    } catch (error: unknown) {
      console.error('Submit attempt error:', error);
      return apiErr('internal_error', 'Internal server error', 500);
    }
  },
);
