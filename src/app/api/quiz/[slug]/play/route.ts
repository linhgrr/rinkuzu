import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import Quiz from '@/models/Quiz';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
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