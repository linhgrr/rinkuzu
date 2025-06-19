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

    // Return quiz with correct answers for flashcards
    const flashcardQuiz = {
      _id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      author: quiz.author,
      slug: quiz.slug,
      questions: quiz.questions.map((q: any) => ({
        question: q.question,
        options: q.options,
        type: q.type,
        correctIndex: q.correctIndex,
        correctIndexes: q.correctIndexes,
      })),
      createdAt: quiz.createdAt,
    };

    return NextResponse.json({
      success: true,
      data: flashcardQuiz
    });

  } catch (error: any) {
    console.error('Get flashcard quiz error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 