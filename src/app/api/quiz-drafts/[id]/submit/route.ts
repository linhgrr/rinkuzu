// Hybrid submit: the published Quiz lives in the Next/Mongoose domain (slug,
// admin approval), while the draft lifecycle is owned by FastAPI. So we create
// the Quiz here from the editor's questions, then tell FastAPI to mark the
// draft submitted (which also cleans up the source PDF).
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk } from '@/lib/api/response';
import { validateQuestionList } from '@/lib/validation/question';
import { fetchQuizDraftServer } from '@/lib/quiz/draftServer';
import { logger } from '@/lib/logger';
import {
  buildAdaptiveServiceHeaders,
  resolveAdaptiveApiUrl,
  resolveAdaptiveProxyTimeoutMs,
} from '@/lib/adaptive/config';

const quizService = serviceFactory.getQuizService();

async function markDraftSubmitted(
  draftId: string,
  quizId: string,
  userId: string,
  userRole: 'admin' | 'user' | null | undefined,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), resolveAdaptiveProxyTimeoutMs());
  try {
    const response = await fetch(
      new URL(`/api/quiz/drafts/${draftId}/submit`, resolveAdaptiveApiUrl()).toString(),
      {
        method: 'POST',
        headers: {
          ...buildAdaptiveServiceHeaders(userId, userRole),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quiz_id: quizId }),
        cache: 'no-store',
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      // The Quiz is already created; a failed mark is non-fatal (the draft will
      // expire on its own). Log and continue so the user reaches their quiz.
      logger.error(
        { draftId, quizId, status: response.status },
        'Failed to mark FastAPI draft submitted',
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}

export const POST = withAuth<{ id: string }>(
  async (request: NextRequest, { params, userId, session }) => {
    try {
      const { id } = params;
      const body = await request.json();
      const { title, categoryId, description, questions: editedQuestions, isPrivate } = body;

      if (!categoryId) {
        return apiErr('validation_error', 'Category is required', 400);
      }

      const validation = validateQuestionList(editedQuestions);
      if (!validation.isValid) {
        return apiErr('validation_error', 'Validation failed', 400, {
          details: validation.errors,
        });
      }

      // Idempotency guard: if the draft was already submitted (e.g. a retried
      // request after a flaky mark, or a double click), reuse the existing Quiz
      // instead of creating a duplicate. The draft is the source of truth for
      // which Quiz it produced.
      const existingDraft = await fetchQuizDraftServer(id, userId);
      if (existingDraft?.status === 'submitted' && existingDraft.submitted_quiz_id) {
        const existing = await quizService.getQuizById(existingDraft.submitted_quiz_id);
        if (existing.success && existing.data) {
          return apiOk({
            quizId: existingDraft.submitted_quiz_id,
            slug: existing.data.slug,
            warnings: validation.warnings,
          });
        }
      }

      const quiz = await quizService.createQuiz(userId, {
        title: title || 'Untitled quiz',
        description: description || '',
        category: categoryId,
        questions: validation.questions,
        isPrivate: Boolean(isPrivate),
      });

      const quizId = String(quiz._id);
      await markDraftSubmitted(id, quizId, userId, session.user.role);

      return apiOk({
        quizId,
        slug: quiz.slug,
        warnings: validation.warnings,
      });
    } catch (error) {
      logger.error({ error }, 'Submit draft error');
      return apiErr('internal_error', 'Failed to submit draft', 500);
    }
  },
);
