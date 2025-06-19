import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongoose';
import Quiz from '@/models/Quiz';
import Category from '@/models/Category';
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
    const category = url.searchParams.get('category');
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
        // All users can see published quizzes that are not private
        filter = {
          status: 'published',
          $or: [
            { isPrivate: false },
            { author: (session.user as any).id }
          ]
        };
      } else if (status === 'pending' || status === 'rejected') {
        // Only their own pending/rejected quizzes
        filter = { author: (session.user as any).id, status };
      } else {
        // Default: published non-private quizzes + their own quizzes
        filter = {
          $or: [
            { status: 'published', isPrivate: false },
            { author: (session.user as any).id }
          ]
        };
      }
    }

    // Add category filter
    if (category && category.trim()) {
      filter.category = category.trim();
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
    console.log('🏷️ Category parameter:', category);

    const [quizzes, total] = await Promise.all([
      Quiz.find(filter)
        .populate('author', 'email')
        .populate('category', 'name color')
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

    const { title, description, category, questions, isPrivate } = await request.json();

    if (!title || !category || !questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Title, category, and questions are required' },
        { status: 400 }
      );
    }

    // Validate category exists and is active
    const categoryDoc = await Category.findOne({ _id: category, isActive: true });
    if (!categoryDoc) {
      return NextResponse.json(
        { success: false, error: 'Invalid or inactive category selected' },
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
        type: question.type,
        correctIndex: question.correctIndex,
        correctIndexes: question.correctIndexes,
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

      // Validate question type
      const questionType = question.type || 'single';
      if (!['single', 'multiple'].includes(questionType)) {
        console.error(`❌ Question ${i + 1}: Invalid type "${questionType}"`);
        return NextResponse.json(
          { success: false, error: `Question ${i + 1}: Type must be 'single' or 'multiple'` },
          { status: 400 }
        );
      }

      // Validate based on question type
      if (questionType === 'single') {
        if (typeof question.correctIndex !== 'number') {
          console.error(`❌ Question ${i + 1}: Single choice questions must have correctIndex as number, got ${typeof question.correctIndex}`);
          return NextResponse.json(
            { success: false, error: `Question ${i + 1}: Single choice questions must have correctIndex as number` },
            { status: 400 }
          );
        }

        if (question.correctIndex < 0 || question.correctIndex >= question.options.length) {
          console.error(`❌ Question ${i + 1}: correctIndex (${question.correctIndex}) out of range (0-${question.options.length - 1})`);
          return NextResponse.json(
            { success: false, error: `Question ${i + 1}: correctIndex out of range` },
            { status: 400 }
          );
        }
      } else if (questionType === 'multiple') {
        if (!Array.isArray(question.correctIndexes)) {
          console.error(`❌ Question ${i + 1}: Multiple choice questions must have correctIndexes as array, got ${typeof question.correctIndexes}`);
          return NextResponse.json(
            { success: false, error: `Question ${i + 1}: Multiple choice questions must have correctIndexes as array` },
            { status: 400 }
          );
        }

        if (question.correctIndexes.length === 0) {
          console.error(`❌ Question ${i + 1}: Multiple choice questions must have at least one correct answer`);
          return NextResponse.json(
            { success: false, error: `Question ${i + 1}: Multiple choice questions must have at least one correct answer` },
            { status: 400 }
          );
        }

        // Check each correctIndex is valid
        for (const idx of question.correctIndexes) {
          if (typeof idx !== 'number' || idx < 0 || idx >= question.options.length) {
            console.error(`❌ Question ${i + 1}: Invalid correctIndex ${idx} (must be 0-${question.options.length - 1})`);
            return NextResponse.json(
              { success: false, error: `Question ${i + 1}: Invalid correctIndex ${idx}` },
              { status: 400 }
            );
          }
        }
      }

      console.log(`✅ Question ${i + 1}: Valid`);
    }

    console.log('✅ All questions validated successfully');

    // Convert questions to Mongoose schema format (already in correct format)
    const mongooseQuestions = questions.map((q: any, index: number) => {
      const mongooseQuestion: any = {
        question: q.question,
        options: q.options,
        type: q.type || 'single'
      };

      if (q.type === 'single') {
        mongooseQuestion.correctIndex = q.correctIndex;
      } else if (q.type === 'multiple') {
        mongooseQuestion.correctIndexes = q.correctIndexes;
      }

      // Include image fields if they exist
      if (q.questionImage) {
        mongooseQuestion.questionImage = q.questionImage;
      }

      if (q.optionImages && Array.isArray(q.optionImages)) {
        mongooseQuestion.optionImages = q.optionImages;
      }

      console.log(`🔄 Mongoose format Question ${index + 1}:`, {
        ...mongooseQuestion,
        hasQuestionImage: !!mongooseQuestion.questionImage,
        hasOptionImages: !!mongooseQuestion.optionImages,
        optionImagesCount: mongooseQuestion.optionImages?.filter(Boolean).length || 0
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
      category,
      author: (session.user as any).id,
      slug,
      questions: mongooseQuestions,
      status: 'pending',
      isPrivate: isPrivate || false
    });

    await quiz.save();
    await quiz.populate([
      { path: 'author', select: 'email' },
      { path: 'category', select: 'name color' }
    ]);

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