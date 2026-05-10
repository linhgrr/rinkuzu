import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { AsyncRouteParams } from '@/types/next-route';
import { apiOk, apiErr } from '@/lib/api/response';

export async function GET(request: NextRequest, { params }: AsyncRouteParams<{ slug: string }>) {
  try {
    const { slug } = await params;
    const session = await getServerSession(authOptions);
    const quizService = serviceFactory.getQuizService();

    const result = await quizService.getQuizForFlashcards(slug, session);

    if (!result.success) {
      return apiErr(
        'service_error',
        String(result.error ?? 'Request failed'),
        result.statusCode || 400,
      );
    }

    return apiOk(result.data);
  } catch (error: unknown) {
    console.error('Get flashcard quiz error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}
