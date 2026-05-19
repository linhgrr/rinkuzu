import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { withAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { AsyncRouteParams } from '@/types/next-route';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';

// GET /api/quiz/[slug]/discussions - Get all discussions for a quiz.
// Public + authenticated dual path: read access is open; service layer
// gates private quizzes.
//
const _authOptions = authOptions;

export async function GET(_request: NextRequest, { params }: AsyncRouteParams<{ slug: string }>) {
  try {
    const { slug } = await params;
    const session = await getServerSession(_authOptions);
    const quizService = serviceFactory.getQuizService();

    const result = await quizService.getQuizDiscussions(slug, session);

    if (!result.success) {
      return apiServiceErr(result, 400);
    }

    return apiOk(result.data);
  } catch (error) {
    console.error('Error fetching discussions:', error);
    return apiErr('internal_error', 'Failed to fetch discussions', 500);
  }
}

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
      console.error('Error adding comment:', error);
      return apiErr('internal_error', 'Failed to add comment', 500);
    }
  },
);
