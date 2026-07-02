import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { readAndValidateJson } from '@/lib/api/request';
import { reportQuizRequestSchema } from '@/dtos/quiz';

export const POST = withAuth<{ slug: string }>(
  async (request: NextRequest, { params, email, session }) => {
    try {
      const { slug } = params;
      if (!email) {
        return apiErr('validation_error', 'User email is required', 400);
      }

      const parsedBody = await readAndValidateJson(request, reportQuizRequestSchema);
      if (!parsedBody.success) {
        return apiErr('validation_error', parsedBody.error, 400, parsedBody.fields);
      }

      const quizService = serviceFactory.getQuizService();

      const result = await quizService.reportQuiz(
        slug,
        parsedBody.data.content,
        email,
        session.user.name || email,
      );

      if (!result.success) {
        return apiServiceErr(result);
      }

      return apiOk(result.data, 200, {
        meta: { message: 'Report submitted successfully' },
      });
    } catch (error) {
      logger.error({ error }, 'Error submitting report');
      return apiErr('internal_error', 'Internal server error', 500);
    }
  },
);
