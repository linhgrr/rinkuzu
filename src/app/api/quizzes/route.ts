import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';

const quizService = serviceFactory.getQuizService();

// GET /api/quizzes - List quizzes with filtering
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const category = url.searchParams.get('category') || undefined;
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const mine = url.searchParams.get('mine');

    const result = await quizService.getQuizzes({
      status,
      search,
      category,
      page,
      limit,
      userRole: (session.user as any).role,
      userId: (session.user as any).id,
      onlyMine: mine !== null && mine !== 'false'
    });

    return NextResponse.json({
      success: true,
      data: {
        quizzes: result.quizzes,
        pagination: result.pagination
      }
    });

  } catch (error: any) {
    console.error('Get quizzes error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/quizzes - Create quiz from prepared data
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { title, description, category, questions, isPrivate } = await request.json();

    const quiz = await quizService.createQuiz((session.user as any).id, {
      title,
      description,
      category,
      questions,
      isPrivate
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Quiz created successfully and sent for approval',
        data: quiz
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Create quiz error:', error);
    
    if (error.message.includes('Title, category, and questions are required') ||
        error.message.includes('Invalid or inactive category selected') ||
        error.message.includes('Question') ||
        error.message.includes('Type must be')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 