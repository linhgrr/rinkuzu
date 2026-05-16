import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk } from '@/lib/api/response';

const quizService = serviceFactory.getQuizService();

// GET /api/quizzes - List quizzes with filtering
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const isGuest = !session?.user;
    const url = new URL(request.url);
    const status = isGuest ? 'published' : url.searchParams.get('status') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const category = url.searchParams.get('category') || undefined;
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const mine = url.searchParams.get('mine');
    const compact = url.searchParams.get('compact') === 'true';

    const result = await quizService.getQuizzes({
      status,
      search,
      category,
      page,
      limit,
      isPrivate: isGuest ? false : undefined,
      userRole: (session?.user as { role?: string })?.role,
      userId: (session?.user as { id?: string })?.id,
      onlyMine: !isGuest && mine !== null && mine !== 'false',
      compact,
    });

    return apiOk({
      quizzes: result.quizzes,
      pagination: result.pagination,
    });
  } catch (error: unknown) {
    console.error('Get quizzes error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}

// POST /api/quizzes - Create quiz from prepared data
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return apiErr('unauthorized', 'Unauthorized', 401);
    }

    const { title, description, category, questions, isPrivate, pdfUrl } = await request.json();

    const quiz = await quizService.createQuiz((session.user as { id: string }).id, {
      title,
      description,
      category,
      questions,
      isPrivate,
      pdfUrl,
    });

    return apiOk(quiz, 201, {
      meta: { message: 'Quiz created successfully and sent for approval' },
    });
  } catch (error: unknown) {
    console.error('Create quiz error:', error);
    const message = error instanceof Error ? error.message : '';

    if (
      message.includes('Title, category, and questions are required') ||
      message.includes('Invalid or inactive category selected') ||
      message.includes('Question') ||
      message.includes('Type must be')
    ) {
      return apiErr('validation_error', message, 400);
    }

    return apiErr('internal_error', 'Internal server error', 500);
  }
}
