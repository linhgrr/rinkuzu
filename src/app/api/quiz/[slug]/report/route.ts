import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import Report from '@/models/Report';
import Quiz from '@/models/Quiz';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    await connectDB();

    const { content } = await request.json();
    
    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Report content is required' }, { status: 400 });
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: 'Report content too long (max 2000 characters)' }, { status: 400 });
    }

    // Find the quiz
    const quiz = await Quiz.findOne({ slug: params.slug });
    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    // Create the report
    const report = new Report({
      quizId: quiz._id.toString(),
      quizTitle: quiz.title,
      quizSlug: quiz.slug,
      reporterEmail: session.user.email,
      reporterName: session.user.name || session.user.email || 'Anonymous',
      content: content.trim(),
      status: 'pending'
    });

    await report.save();

    return NextResponse.json({ 
      message: 'Report submitted successfully',
      reportId: report._id 
    });

  } catch (error) {
    console.error('Error submitting report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 