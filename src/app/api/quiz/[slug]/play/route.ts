import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import Quiz from '@/models/Quiz';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    await connectDB();

    const quiz = await Quiz.findOne({ 
      slug: params.slug, 
      status: 'published' 
    }).populate('author', 'email');

    if (!quiz) {
      return NextResponse.json(
        { success: false, error: 'Quiz not found or not published' },
        { status: 404 }
      );
    }

    // Check if quiz is private and user has access
    if (quiz.isPrivate) {
      if (!session?.user) {
        return NextResponse.json(
          { success: false, error: 'Access denied. This quiz is private.' },
          { status: 403 }
        );
      }

      const isAdmin = (session.user as any).role === 'admin';
      const isAuthor = quiz.author._id.toString() === (session.user as any).id;

      if (!isAdmin && !isAuthor) {
        return NextResponse.json(
          { success: false, error: 'Access denied. This quiz is private.' },
          { status: 403 }
        );
      }
    }

    // Remove correct answers from questions for security
    const safeQuestions = quiz.questions.map((q: any) => ({
      question: q.question,
      options: q.options,
      type: q.type,
      questionImage: q.questionImage ?? null,
      optionImages: q.optionImages ?? [],
      // Exclude correct answers
    }));

    const safeQuiz = {
      _id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      author: quiz.author,
      slug: quiz.slug,
      questions: safeQuestions,
      createdAt: quiz.createdAt,
    };

    return NextResponse.json({
      success: true,
      data: safeQuiz
    });

  } catch (error: any) {
    console.error('Get quiz for play error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 