import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongoose';
import Quiz from '@/models/Quiz';
import { extractQuestionsFromPdf } from '@/lib/gemini';
import { generateSlug, fileToBuffer } from '@/lib/utils';
import { authOptions } from '@/lib/auth';

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
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    await connectDB();

    let filter: any = {};

    // Role-based filtering
    if ((session.user as any).role === 'admin') {
      // Admin can see all quizzes, optionally filtered by status
      if (status) filter.status = status;
    } else {
      // For regular users
      if (status === 'published') {
        // All users can see all published quizzes (public access)
        filter.status = 'published';
      } else if (status === 'pending' || status === 'rejected') {
        // Only their own pending/rejected quizzes
        filter = { author: (session.user as any).id, status };
      } else {
        // Default: published quizzes + their own quizzes
        filter = {
          $or: [
            { status: 'published' },
            { author: (session.user as any).id }
          ]
        };
      }
    }

    // Add search functionality
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i'); // Case-insensitive search
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { title: searchRegex },
          { description: searchRegex }
        ]
      });
    }

    console.log('📋 Quiz filter:', JSON.stringify(filter, null, 2));

    const [quizzes, total] = await Promise.all([
      Quiz.find(filter)
        .populate('author', 'email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Quiz.countDocuments(filter)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        quizzes,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
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

    const { title, description, questions } = await request.json();

    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Title and questions are required' },
        { status: 400 }
      );
    }

    // Validate questions format with detailed logging
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      
      console.log(`🔍 Validating Question ${i + 1}:`, {
        hasQuestion: !!question.question,
        hasOptions: !!question.options,
        isOptionsArray: Array.isArray(question.options),
        optionsLength: question.options?.length,
        correctAnswer: question.correctAnswer,
        correctAnswerType: typeof question.correctAnswer,
        fullQuestion: question
      });

      if (!question.question || typeof question.question !== 'string') {
        console.error(`❌ Question ${i + 1}: Missing or invalid question text`);
        return NextResponse.json(
          { success: false, error: `Question ${i + 1}: Missing or invalid question text` },
          { status: 400 }
        );
      }

      if (!question.options || !Array.isArray(question.options)) {
        console.error(`❌ Question ${i + 1}: Missing or invalid options array`);
        return NextResponse.json(
          { success: false, error: `Question ${i + 1}: Missing or invalid options array` },
          { status: 400 }
        );
      }

      if (question.options.length < 2) {
        console.error(`❌ Question ${i + 1}: Need at least 2 options`);
        return NextResponse.json(
          { success: false, error: `Question ${i + 1}: Need at least 2 options` },
          { status: 400 }
        );
      }

      // Check each option is a string
      for (let j = 0; j < question.options.length; j++) {
        if (typeof question.options[j] !== 'string') {
          console.error(`❌ Question ${i + 1}, Option ${j + 1}: Must be a string`);
          return NextResponse.json(
            { success: false, error: `Question ${i + 1}, Option ${j + 1}: Must be a string` },
            { status: 400 }
          );
        }
      }

      if (typeof question.correctAnswer !== 'number') {
        console.error(`❌ Question ${i + 1}: correctAnswer must be a number, got ${typeof question.correctAnswer}`);
        return NextResponse.json(
          { success: false, error: `Question ${i + 1}: correctAnswer must be a number` },
          { status: 400 }
        );
      }

      if (question.correctAnswer < 0 || question.correctAnswer >= question.options.length) {
        console.error(`❌ Question ${i + 1}: correctAnswer (${question.correctAnswer}) out of range (0-${question.options.length - 1})`);
        return NextResponse.json(
          { success: false, error: `Question ${i + 1}: correctAnswer out of range` },
          { status: 400 }
        );
      }

      console.log(`✅ Question ${i + 1}: Valid`);
    }

    console.log('✅ All questions validated successfully');

    // Convert questions to Mongoose schema format
    const mongooseQuestions = questions.map((q: any, index: number) => {
      const mongooseQuestion: any = {
        question: q.question,
        options: q.options,
        type: q.type || 'single'
      };

      // Convert correctAnswer back to Mongoose format
      if (q.type === 'multiple' && q.originalCorrectIndexes) {
        mongooseQuestion.correctIndexes = q.originalCorrectIndexes;
      } else {
        mongooseQuestion.correctIndex = q.correctAnswer;
      }

      console.log(`🔄 Converting to Mongoose format Question ${index + 1}:`, {
        original: q,
        mongoose: mongooseQuestion
      });

      return mongooseQuestion;
    });

    await connectDB();

    // Generate unique slug
    const slug = generateSlug(title);

    // Create quiz
    const quiz = new Quiz({
      title,
      description,
      author: (session.user as any).id,
      slug,
      questions: mongooseQuestions,
      status: 'pending'
    });

    await quiz.save();
    await quiz.populate('author', 'email');

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
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
} 