// /src/app/api/draft/[id]/submit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import DraftQuiz from '@/models/DraftQuiz';
import Quiz from '@/models/Quiz';

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

    if (draft.status !== 'completed') {
      return NextResponse.json(
        { error: 'Draft is not ready for submission' },
        { status: 400 }
      );
    }

    // Use edited questions if provided, otherwise use draft questions
    const questionsToUse = editedQuestions || draft.questions;

    if (!questionsToUse || questionsToUse.length === 0) {
      return NextResponse.json(
        { error: 'No questions to submit' },
        { status: 400 }
      );
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

    // Delete the draft
    await DraftQuiz.deleteOne({ _id: params.id });

    return NextResponse.json({
      success: true,
      quizId: quiz._id.toString(),
      slug: quiz.slug,
    });

  } catch (error) {
    console.error('Submit draft error:', error);
    return NextResponse.json(
      { error: 'Failed to submit draft' },
      { status: 500 }
    );
  }
}
