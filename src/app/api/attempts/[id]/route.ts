import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import Attempt from '@/models/Attempt';
import User from '@/models/User';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    await connectDB();

    // Find user
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Get attempt with quiz details including questions
    const attempt = await Attempt.findOne({ 
      _id: params.id,
      user: user._id 
    }).populate({
      path: 'quiz',
      select: 'title slug description questions',
    });

    if (!attempt) {
      return NextResponse.json(
        { success: false, error: 'Attempt not found' },
        { status: 404 }
      );
    }

    // Format the response with question details and user answers
    const formattedAttempt = {
      _id: attempt._id,
      score: attempt.score,
      takenAt: attempt.takenAt,
      answers: attempt.answers,
      quiz: {
        title: attempt.quiz.title,
        slug: attempt.quiz.slug,
        description: attempt.quiz.description,
        questions: attempt.quiz.questions.map((question: any, index: number) => ({
          question: question.question,
          options: question.options,
          type: question.type,
          correctIndex: question.correctIndex,
          correctIndexes: question.correctIndexes,
          questionImage: question.questionImage,
          optionImages: question.optionImages,
          userAnswer: attempt.answers[index],
          isCorrect: question.type === 'single' 
            ? attempt.answers[index] === question.correctIndex
            : Array.isArray(attempt.answers[index]) && Array.isArray(question.correctIndexes)
              ? question.correctIndexes.length === attempt.answers[index].length &&
                question.correctIndexes.every((idx: number) => attempt.answers[index].includes(idx))
              : false
        }))
      },
    };

    return NextResponse.json({
      success: true,
      data: formattedAttempt,
    });

  } catch (error: any) {
    console.error('Get attempt details error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 