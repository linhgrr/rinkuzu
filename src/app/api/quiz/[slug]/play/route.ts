import { NextRequest } from 'next/server';
import { withOptionalAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';

const quizService = serviceFactory.getQuizService();

export const GET = withOptionalAuth<{ slug: string }>(
  async (_request: NextRequest, { params, userId, session }) => {
    try {
      const { slug } = params;
      const userRole = session?.user?.role;

      const result = await quizService.getQuizForPlay(slug, userRole, userId ?? undefined);

      if (!result.success) {
        return apiServiceErr(result, 500);
      }

      return apiOk(result.data);
    } catch (error: unknown) {
      console.error('Get quiz for play error:', error);
      return apiErr('internal_error', 'Internal server error', 500);
    }
  },
);
