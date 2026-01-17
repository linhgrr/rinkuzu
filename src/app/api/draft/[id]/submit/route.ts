// /src/app/api/draft/[id]/submit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import DraftQuiz from '@/models/DraftQuiz';
import Quiz from '@/models/Quiz';
import { deletePDF } from '@/lib/s3';

// Simple slug generator (inline to avoid import issues)
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

function validateQuestions(questions: any[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!questions || questions.length === 0) {
    errors.push('Cần ít nhất 1 câu hỏi');
    return { isValid: false, errors, warnings };
  }

  questions.forEach((q, index) => {
    const prefix = `Câu ${index + 1}`;

    // Required fields
    if (!q.question?.trim()) {
      errors.push(`${prefix}: Thiếu nội dung câu hỏi`);
    }

    if (!Array.isArray(q.options) || q.options.length < 2) {
      errors.push(`${prefix}: Cần ít nhất 2 đáp án`);
    }

    // Check for empty options
    const emptyOptions = q.options?.filter((opt: string) => !opt?.trim());
    if (emptyOptions?.length > 0) {
      errors.push(`${prefix}: Có đáp án trống`);
    }

    // Validate correct answer
    if (q.type === 'single') {
      if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex >= q.options?.length) {
        errors.push(`${prefix}: Đáp án đúng không hợp lệ`);
      }
    } else if (q.type === 'multiple') {
      if (!Array.isArray(q.correctIndexes) || q.correctIndexes.length === 0) {
        errors.push(`${prefix}: Cần chọn ít nhất 1 đáp án đúng`);
      } else {
        const invalidIndexes = q.correctIndexes.filter(
          (idx: number) => idx < 0 || idx >= q.options?.length
        );
        if (invalidIndexes.length > 0) {
          errors.push(`${prefix}: Có đáp án đúng không hợp lệ`);
        }
      }
    } else {
      errors.push(`${prefix}: Loại câu hỏi không hợp lệ`);
    }
  });

  // Warnings (non-blocking)
  if (questions.length < 5) {
    warnings.push('Quiz nên có ít nhất 5 câu hỏi');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, categoryId, description, questions: editedQuestions } = body;

    if (!categoryId) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const draft = await DraftQuiz.findOne({
      _id: params.id,
      userId: ((session!.user as any) as any).id,
    });

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Allow submit if completed OR if has questions (partial completion)
    const questionsToUse = editedQuestions || draft.questions;

    // Validate questions
    const validation = validateQuestions(questionsToUse);

    if (!validation.isValid) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.errors,
      }, { status: 400 });
    }

    // Generate unique slug
    const baseSlug = generateSlug(title || draft.title);
    let slug = baseSlug;
    let counter = 1;
    while (await Quiz.findOne({ slug })) {
      slug = `${baseSlug}-${counter++}`;
    }

    // Create quiz
    const quiz = await Quiz.create({
      title: title || draft.title,
      description: description || '',
      category: categoryId,
      status: 'pending', // Requires admin approval
      author: ((session!.user as any) as any).id,
      slug,
      questions: questionsToUse.map((q: any) => ({
        question: q.question,
        options: q.options,
        type: q.type,
        correctIndex: q.correctIndex,
        correctIndexes: q.correctIndexes,
      })),
      isPrivate: false,
    });

    // Delete the draft from MongoDB
    await DraftQuiz.deleteOne({ _id: params.id });

    // Cleanup S3 (best effort - don't fail if this fails)
    if (draft.pdfData?.pdfKey) {
      try {
        await deletePDF(draft.pdfData.pdfKey);
        console.log('Deleted PDF from S3 after submit:', draft.pdfData.pdfKey);
      } catch (s3Error) {
        console.error('Failed to delete PDF from S3 after submit:', s3Error);
        // Don't fail the request - quiz was created successfully
      }
    }

    return NextResponse.json({
      success: true,
      quizId: quiz._id.toString(),
      slug: quiz.slug,
      warnings: validation.warnings,
    });

  } catch (error) {
    console.error('Submit draft error:', error);
    return NextResponse.json(
      { error: 'Failed to submit draft' },
      { status: 500 }
    );
  }
}
