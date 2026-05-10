import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { AsyncRouteParams } from '@/types/next-route';
import { apiErr } from '@/lib/api/response';

// GET /api/quizzes/[id] - Get specific quiz
export async function GET(request: NextRequest, { params }: AsyncRouteParams<{ id: string }>) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return apiErr('unauthorized', 'Unauthorized', 401);
    }
    const userEmail = session.user.email;
    if (!userEmail) {
      return apiErr('validation_error', 'User email is required', 400);
    }

    const quizService = serviceFactory.getQuizService();

    const result = await quizService.getQuizById(id, userEmail, (session.user as any).role);

    if (!result.success) {
      return apiErr('service_error', result.error ?? 'Request failed', result.statusCode || 400);
    }

    const data = result.data;

    // Refresh signed URL if PDF exists
    if (data && (data as any).pdfUrl) {
      try {
        const { getSignedPDFUrl, BUCKET_NAME } = await import('@/lib/s3');
        const pdfUrl = (data as any).pdfUrl;
        const marker = `${BUCKET_NAME}/`;

        if (pdfUrl.includes(marker)) {
          const key = pdfUrl.split(marker)[1];
          if (key) {
            // Use a temporary variable to avoid mutating potentially frozen state if necessary,
            // but here we are constructing the response
            (data as any).pdfUrl = await getSignedPDFUrl(key);
          }
        }
      } catch (error) {
        console.error('Failed to refresh signed URL for quiz:', error);
      }
    }

    return NextResponse.json({
      success: true,
      data: data,
    });
  } catch (error: any) {
    console.error('Get quiz error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}

// PUT /api/quizzes/[id] - Update quiz (only author or admin)
export async function PUT(request: NextRequest, { params }: AsyncRouteParams<{ id: string }>) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return apiErr('unauthorized', 'Unauthorized', 401);
    }
    const userEmail = session.user.email;
    if (!userEmail) {
      return apiErr('validation_error', 'User email is required', 400);
    }

    const quizData = await request.json();
    const quizService = serviceFactory.getQuizService();

    const result = await quizService.updateQuiz(
      id,
      quizData,
      userEmail,
      (session.user as any).role,
    );

    if (!result.success) {
      return apiErr('service_error', result.error ?? 'Request failed', result.statusCode || 400);
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error: any) {
    console.error('Update quiz error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}

// DELETE /api/quizzes/[id] - Delete quiz (only author or admin)
export async function DELETE(request: NextRequest, { params }: AsyncRouteParams<{ id: string }>) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return apiErr('unauthorized', 'Unauthorized', 401);
    }
    const userEmail = session.user.email;
    if (!userEmail) {
      return apiErr('validation_error', 'User email is required', 400);
    }

    const quizService = serviceFactory.getQuizService();

    const result = await quizService.deleteQuiz(id, userEmail, (session.user as any).role);

    if (!result.success) {
      return apiErr('service_error', result.error ?? 'Request failed', result.statusCode || 400);
    }

    return NextResponse.json({
      success: true,
      message: 'Quiz deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete quiz error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}
