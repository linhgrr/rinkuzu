import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';

export const POST = withAdmin<{ id: string }>(async (request: NextRequest, { params }) => {
  try {
    const { id } = params;
    const { reason } = await request.json();
    const quizService = serviceFactory.getQuizService();

    const result = await quizService.rejectQuiz(id, reason);

    if (!result.success) {
      return apiServiceErr(result, 400);
    }

    return apiOk(result.data, 200, { meta: { message: 'Quiz rejected successfully' } });
  } catch (error) {
    console.error('Reject quiz error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
