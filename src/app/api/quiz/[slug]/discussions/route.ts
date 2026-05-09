import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { AsyncRouteParams } from '@/types/next-route';
import { apiOk, apiErr } from '@/lib/api/response';

// GET /api/quiz/[slug]/discussions - Get all discussions for a quiz
export async function GET(request: NextRequest, { params }: AsyncRouteParams<{ slug: string }>) {
  try {
    const { slug } = await params;
    const session = await getServerSession(authOptions);
    const quizService = serviceFactory.getQuizService();

    const result = await quizService.getQuizDiscussions(slug, session);

    if (!result.success) {
      return apiErr(
        'service_error',
        String(result.error ?? 'Request failed'),
        result.statusCode || 400,
      );
    }

    return apiOk(result.data);
  } catch (error) {
    console.error('Error fetching discussions:', error);
    return apiErr('internal_error', 'Failed to fetch discussions', 500);
  }
}

// POST /api/quiz/[slug]/discussions - Add a new comment to a question
export async function POST(request: NextRequest, { params }: AsyncRouteParams<{ slug: string }>) {
  try {
    const { slug } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return apiErr('unauthorized', 'Authentication required', 401);
    }

    const { questionIndex, content } = await request.json();

    if (typeof questionIndex !== 'number' || !content?.trim()) {
      return apiErr('invalid_request', 'Question index and content are required', 400);
    }

    const quizService = serviceFactory.getQuizService();

    const result = await quizService.addDiscussionComment(
      slug,
      questionIndex,
      content.trim(),
      session.user.email,
      session,
    );

    if (!result.success) {
      return apiErr(
        'service_error',
        String(result.error ?? 'Request failed'),
        result.statusCode || 400,
      );
    }

    return apiOk(result.data);
  } catch (error) {
    console.error('Error adding comment:', error);
    return apiErr('internal_error', 'Failed to add comment', 500);
  }
}
