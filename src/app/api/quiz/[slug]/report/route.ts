import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { content } = await request.json();
    
    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Report content is required' }, { status: 400 });
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: 'Report content too long (max 2000 characters)' }, { status: 400 });
    }

    const quizService = serviceFactory.getQuizService();
    
    const result = await quizService.reportQuiz(
      params.slug,
      content.trim(),
      session.user.email!,
      session.user.name || session.user.email || 'Anonymous'
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode || 400 });
    }

    return NextResponse.json({ 
      message: 'Report submitted successfully',
      reportId: result.data 
    });

  } catch (error) {
    console.error('Error submitting report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 