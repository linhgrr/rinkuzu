import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import Attempt from '@/models/Attempt';
import Quiz from '@/models/Quiz';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const attempt = await Attempt.findById(params.id).populate('quiz');

    if (!attempt) {
      return NextResponse.json(
        { success: false, error: 'Attempt not found' },
        { status: 404 }
      );
    }

    const quiz = attempt.quiz;

    // Calculate detailed results
    const results = quiz.questions.map((question: any, index: number) => {
      const userAnswer = attempt.answers[index];
      let isCorrect = false;
      let isAnswered = false;
      
      if (question.type === 'single') {
        // Check if answered (not -1)
        isAnswered = userAnswer !== -1;
        // Only mark as correct if answered and correct
        isCorrect = isAnswered && userAnswer === question.correctIndex;
      } else if (question.type === 'multiple' && question.correctIndexes) {
        // Check if answered (not empty array)
        isAnswered = Array.isArray(userAnswer) && userAnswer.length > 0;
        // Only mark as correct if answered and correct
        if (isAnswered) {
          const userSet = new Set(userAnswer.sort());
          const correctSet = new Set(question.correctIndexes.sort());
          isCorrect = userSet.size === correctSet.size && 
                     [...userSet].every(x => correctSet.has(x));
        }
      }
      
      return {
        question: question.question,
        options: question.options,
        type: question.type,
        questionImage: question.questionImage ?? null,
        optionImages: question.optionImages ?? [],
        userAnswer,
        correctAnswer: question.type === 'single' ? question.correctIndex : question.correctIndexes,
        isCorrect,
        isAnswered,
      };
    });

    const correctAnswers = results.filter((r: any) => r.isCorrect).length;

    return NextResponse.json({
      success: true,
      data: {
        score: attempt.score,
        totalQuestions: quiz.questions.length,
        correctAnswers,
        results,
        quizTitle: quiz.title,
        takenAt: attempt.takenAt,
      }
    });

  } catch (error: any) {
    console.error('Get attempt error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 