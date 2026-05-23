// /src/app/api/draft/[id]/submit/route.ts
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import connectDB from '@/lib/mongoose';
import DraftQuiz from '@/models/DraftQuiz';
import Quiz from '@/models/Quiz';
import { deletePDF } from '@/lib/s3';
import { apiErr, apiOk } from '@/lib/api/response';
import { validateQuestionList } from '@/lib/validation/question';
import { logger } from '@/lib/logger';

// Simple slug generator (inline to avoid import issues)
function generateSlug(title: string): string {
  const normalized = title.toLowerCase().trim();
  let slug = '';
  let previousWasSeparator = false;

  for (const char of normalized) {
    const isAsciiLetter = char >= 'a' && char <= 'z';
    const isDigit = char >= '0' && char <= '9';
    const isSeparator = char === ' ' || char === '_' || char === '-';

    if (isAsciiLetter || isDigit) {
      slug += char;
      previousWasSeparator = false;
      continue;
    }

    if (isSeparator && slug.length > 0 && !previousWasSeparator) {
      slug += '-';
      previousWasSeparator = true;
    }
  }

  if (slug.endsWith('-')) {
    slug = slug.slice(0, -1);
  }

  return slug.slice(0, 100);
}

export const POST = withAuth<{ id: string }>(async (request: NextRequest, { params, userId }) => {
  try {
    const { id } = params;

    const body = await request.json();
    const { title, categoryId, description, questions: editedQuestions } = body;

    if (!categoryId) {
      return apiErr('validation_error', 'Category is required', 400);
    }

    await connectDB();

    const draft = await DraftQuiz.findOne({
      _id: id,
      userId,
    });

    if (!draft) {
      return apiErr('not_found', 'Draft not found', 404);
    }

    // Allow submit if completed OR if has questions (partial completion)
    const questionsToUse = editedQuestions || draft.questions;

    // Validate questions via shared zod schema
    const validation = validateQuestionList(questionsToUse);

    if (!validation.isValid) {
      return apiErr('validation_error', 'Validation failed', 400, {
        details: validation.errors,
      });
    }

    // Generate unique slug
    const baseSlug = generateSlug(title || draft.title);
    let slug = baseSlug;
    let counter = 1;
    while (await Quiz.findOne({ slug })) {
      slug = `${baseSlug}-${counter++}`;
    }

    // Create quiz from validated questions
    const quiz = await Quiz.create({
      title: title || draft.title,
      description: description || '',
      category: categoryId,
      status: 'pending', // Requires admin approval
      author: userId,
      slug,
      questions: validation.questions.map((q) => ({
        question: q.question,
        options: q.options,
        type: q.type,
        correctIndex: q.type === 'single' ? q.correctIndex : undefined,
        correctIndexes: q.type === 'multiple' ? q.correctIndexes : undefined,
      })),
      isPrivate: false,
    });

    // Delete the draft from MongoDB
    await DraftQuiz.deleteOne({ _id: id });

    // Cleanup S3 (best effort - don't fail if this fails)
    if (draft.pdfData?.pdfKey) {
      try {
        await deletePDF(draft.pdfData.pdfKey);
        console.warn('Deleted PDF from S3 after submit:', draft.pdfData.pdfKey);
      } catch (s3Error) {
        logger.error({ s3Error }, 'Failed to delete PDF from S3 after submit');
        // Don't fail the request - quiz was created successfully
      }
    }

    return apiOk({
      quizId: quiz._id.toString(),
      slug: quiz.slug,
      warnings: validation.warnings,
    });
  } catch (error) {
    logger.error({ error }, 'Submit draft error');
    return apiErr('internal_error', 'Failed to submit draft', 500);
  }
});
