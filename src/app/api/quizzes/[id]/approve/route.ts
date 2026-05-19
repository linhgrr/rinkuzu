import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';

export const POST = withAdmin<{ id: string }>(async (_request: NextRequest, { params }) => {
  try {
    const { id } = params;
    const quizService = serviceFactory.getQuizService();

    const result = await quizService.approveQuiz(id);

    if (!result.success) {
      return apiServiceErr(result, 400);
    }

    return apiOk(result.data, 200, {
      meta: { message: 'Quiz approved and published successfully' },
    });
  } catch (error) {
    console.error('Approve quiz error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
