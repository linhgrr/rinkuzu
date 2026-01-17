import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';

// GET /api/quizzes/[id] - Get specific quiz
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const quizService = serviceFactory.getQuizService();

    const result = await quizService.getQuizById(
      params.id,
      session.user.email!,
      (session.user as any).role
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.statusCode || 400 }
      );
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
      data: data
    });

  } catch (error: any) {
    console.error('Get quiz error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/quizzes/[id] - Update quiz (only author or admin)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const quizData = await request.json();
    const quizService = serviceFactory.getQuizService();

    const result = await quizService.updateQuiz(
      params.id,
      quizData,
      session.user.email!,
      (session.user as any).role
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.statusCode || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data
    });

  } catch (error: any) {
    console.error('Update quiz error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/quizzes/[id] - Delete quiz (only author or admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const quizService = serviceFactory.getQuizService();

    const result = await quizService.deleteQuiz(
      params.id,
      session.user.email!,
      (session.user as any).role
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.statusCode || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Quiz deleted successfully'
    });

  } catch (error: any) {
    console.error('Delete quiz error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 