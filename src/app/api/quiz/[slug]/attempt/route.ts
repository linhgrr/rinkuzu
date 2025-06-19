import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import Quiz from '@/models/Quiz';
import Attempt from '@/models/Attempt';
import User from '@/models/User';
import { calculateScore } from '@/lib/utils';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const { answers, userEmail } = await request.json();

    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json(
        { success: false, error: 'Answers array is required' },
        { status: 400 }
      );
    }

    // For non-logged in users, require email
    if (!session?.user?.email && !userEmail) {
      return NextResponse.json(
        { success: false, error: 'User email is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const quiz = await Quiz.findOne({ 
      slug: params.slug, 
      status: 'published' 
    });

    if (!quiz) {
      return NextResponse.json(
        { success: false, error: 'Quiz not found or not published' },
        { status: 404 }
      );
    }

    if (answers.length !== quiz.questions.length) {
      return NextResponse.json(
        { success: false, error: 'Answers count must match questions count' },
        { status: 400 }
      );
    }

    // Validate answers based on question types
    for (let i = 0; i < answers.length; i++) {
      const answer = answers[i];
      const question = quiz.questions[i];
      const maxOptionIndex = question.options.length - 1;
      
      console.log(`Validating question ${i + 1}:`, {
        type: question.type,
        answer,
        optionsCount: question.options.length,
        maxOptionIndex
      });
      
      if (question.type === 'single') {
        // Allow -1 for unanswered questions, or valid option index based on actual options count
        if (typeof answer !== 'number' || (answer !== -1 && (answer < 0 || answer > maxOptionIndex))) {
          console.error(`Single choice validation failed for question ${i + 1}:`, {
            answer,
            expectedRange: `0-${maxOptionIndex} or -1`,
            actualType: typeof answer
          });
          return NextResponse.json(
            { success: false, error: `Single choice answer ${i + 1} must be -1 (unanswered) or between 0 and ${maxOptionIndex}` },
            { status: 400 }
          );
        }
      } else if (question.type === 'multiple') {
        // Allow empty array for unanswered questions, or array of valid option indexes
        if (!Array.isArray(answer) || 
            (answer.length > 0 && answer.some(a => typeof a !== 'number' || a < 0 || a > maxOptionIndex))) {
          console.error(`Multiple choice validation failed for question ${i + 1}:`, {
            answer,
            expectedRange: `0-${maxOptionIndex}`,
            invalidItems: answer.length > 0 ? answer.filter((a: any) => typeof a !== 'number' || a < 0 || a > maxOptionIndex) : []
          });
          return NextResponse.json(
            { success: false, error: `Multiple choice answer ${i + 1} must be an empty array (unanswered) or an array of numbers between 0 and ${maxOptionIndex}` },
            { status: 400 }
          );
        }
      }
    }

    // Calculate score using updated logic
    const score = calculateScore(answers, quiz.questions);

    // Get user if logged in
    let userId = null;
    if (session?.user?.email) {
      const user = await User.findOne({ email: session.user.email });
      if (user) {
        userId = user._id;
      }
    }

    // Create attempt record
    const attempt = new Attempt({
      user: userId, // Store user ID if logged in, null for anonymous
      quiz: quiz._id,
      score,
      answers,
      takenAt: new Date(),
    });

    await attempt.save();

    // Return results with correct answers
    const results = quiz.questions.map((question: any, index: number) => {
      const userAnswer = answers[index];
      let isCorrect = false;
      
      if (question.type === 'single') {
        // Only mark as correct if answered and correct (not -1)
        isCorrect = userAnswer !== -1 && userAnswer === question.correctIndex;
      } else if (question.type === 'multiple' && question.correctIndexes) {
        // Only mark as correct if answered and correct (not empty array)
        if (Array.isArray(userAnswer) && userAnswer.length > 0) {
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
        isAnswered: question.type === 'single' ? userAnswer !== -1 : (Array.isArray(userAnswer) && userAnswer.length > 0),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        score,
        totalQuestions: quiz.questions.length,
        correctAnswers: results.filter((r: any) => r.isCorrect).length,
        results,
        attemptId: attempt._id,
      }
    });

  } catch (error: any) {
    console.error('Submit attempt error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 