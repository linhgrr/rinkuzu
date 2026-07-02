// Hybrid submit: the Quiz lives in the Next/Mongoose domain, while
// the draft lifecycle is owned by FastAPI. So we create
// the Quiz here from the editor's questions, then tell FastAPI to mark the
// draft submitted (which also cleans up the source PDF).
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk } from '@/lib/api/response';
import { readAndValidateJson } from '@/lib/api/request';
import { submitQuizDraftRequestSchema } from '@/dtos/quiz-draft';
import { getQuestionListWarnings } from '@/lib/validation/question';
import { fetchQuizDraftServer } from '@/lib/quiz/draftServer';
import { logger } from '@/lib/logger';
import { QuizCreationError, QuizDraftSynchronizationError } from '@/lib/quiz/errors';
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
      throw new QuizDraftSynchronizationError(draftId, quizId, response.status);
    }
  } catch (error) {
    if (error instanceof QuizDraftSynchronizationError) {
      throw error;
    }
    throw new QuizDraftSynchronizationError(draftId, quizId);
  } finally {
    clearTimeout(timeout);
  }
}

export const POST = withAuth<{ id: string }>(
  async (request: NextRequest, { params, userId, session }) => {
    try {
      const { id } = params;
      const input = await readAndValidateJson(request, submitQuizDraftRequestSchema);
      if (!input.success) {
        return apiErr('validation_error', input.error, 400, {
          fields: input.fields,
        });
      }
      const { title, folderId, description, questions, isPrivate } = input.data;
      const warnings = getQuestionListWarnings(questions.length);

      // Idempotency guard: if the draft was already submitted (e.g. a retried
      // request after a flaky mark, or a double click), reuse the existing Quiz
      // instead of creating a duplicate. The draft is the source of truth for
      // which Quiz it produced.
      const existingDraft = await fetchQuizDraftServer(id, userId);
      if (existingDraft?.status === 'submitted' && existingDraft.submittedQuizId) {
        const existing = await quizService.getQuizById(existingDraft.submittedQuizId);
        if (existing.success && existing.data) {
          return apiOk({
            quizId: existingDraft.submittedQuizId,
            slug: existing.data.slug,
            warnings,
          });
        }
        return apiErr('conflict', 'Draft points to a submitted quiz that no longer exists', 409);
      }

      const quiz = await quizService.createQuizFromDraft(userId, id, {
        title,
        description,
        folderId: folderId ?? null,
        questions,
        isPrivate,
      });

      const quizId = quiz.id;
      await markDraftSubmitted(id, quizId, userId, session.user.role);

      return apiOk({
        quizId,
        slug: quiz.slug,
        warnings,
      });
    } catch (error) {
      logger.error({ error }, 'Submit draft error');
      if (error instanceof QuizCreationError) {
        const status = error.code === 'premium_required' ? 403 : 400;
        const code = error.code === 'premium_required' ? 'forbidden' : 'validation_error';
        return apiErr(code, error.message, status);
      }
      if (error instanceof QuizDraftSynchronizationError) {
        return apiErr('upstream_error', error.message, 502, {
          draftId: error.draftId,
          quizId: error.quizId,
          upstreamStatus: error.upstreamStatus,
        });
      }
      return apiErr('internal_error', 'Failed to submit draft', 500);
    }
  },
);
