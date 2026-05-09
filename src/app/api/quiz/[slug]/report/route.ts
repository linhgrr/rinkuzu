import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { AsyncRouteParams } from '@/types/next-route';
import { apiOk, apiErr } from '@/lib/api/response';

export async function POST(request: NextRequest, { params }: AsyncRouteParams<{ slug: string }>) {
  try {
    const { slug } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return apiErr('unauthorized', 'Authentication required', 401);
    }
    const userEmail = session.user.email;
    if (!userEmail) {
      return apiErr('email_required', 'User email is required', 400);
    }

    const { content } = await request.json();

    if (!content || content.trim().length === 0) {
      return apiErr('invalid_request', 'Report content is required', 400);
    }

    if (content.length > 2000) {
      return apiErr('invalid_request', 'Report content too long (max 2000 characters)', 400);
    }

    const quizService = serviceFactory.getQuizService();

    const result = await quizService.reportQuiz(
      slug,
      content.trim(),
      userEmail,
      session.user.name || userEmail,
    );

    if (!result.success) {
      return apiErr(
        'service_error',
        String(result.error ?? 'Request failed'),
        result.statusCode || 400,
      );
    }

    return apiOk({ message: 'Report submitted successfully', reportId: result.data });
  } catch (error) {
    console.error('Error submitting report:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}
