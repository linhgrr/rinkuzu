// Hybrid submit: the Quiz lives in the Next/Mongoose domain, while
// the draft lifecycle is owned by FastAPI. So we create
// the Quiz here from the editor's questions, then tell FastAPI to mark the
// draft submitted (which also cleans up the source PDF).
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { getQuizService } from '@/lib/quiz-factory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { parseParamsAndBody } from '@/lib/api/validated';
import { submitQuizDraftRequestSchema } from '@/dtos/quiz-draft';
import { quizDraftIdRouteParamsSchema } from '@/dtos/quiz';
import { getQuestionListWarnings } from '@/lib/validation/question';
import { fetchQuizDraftServer } from '@/lib/quiz/draftServer';
import { logger } from '@/lib/logger';
import { QuizDraftSynchronizationError } from '@/lib/quiz/errors';
import { quizAuthoringErrorResponse } from '@/lib/api/quiz-authoring-error';
import {
  buildAdaptiveServiceHeaders,
  buildAdaptiveUrl,
  resolveAdaptiveProxyTimeoutMs,
} from '@/lib/adaptive/config';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';

const quizService = getQuizService();

async function markDraftSubmitted(
  draftId: string,
  quizId: string,
  userId: string,
  userRole: 'admin' | 'user' | null | undefined,
  retainSource: boolean,
): Promise<void> {
  try {
    const response = await fetch(buildAdaptiveUrl(`/quiz/drafts/${draftId}/submit`), {
      method: 'POST',
      headers: {
        ...buildAdaptiveServiceHeaders(userId, userRole),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ quiz_id: quizId, retain_source: retainSource }),
      cache: 'no-store',
      signal: AbortSignal.timeout(resolveAdaptiveProxyTimeoutMs()),
    });
    if (!response.ok) {
      throw new QuizDraftSynchronizationError(draftId, quizId, response.status);
    }
  } catch (error) {
    if (error instanceof QuizDraftSynchronizationError) {
      throw error;
    }
    throw new QuizDraftSynchronizationError(draftId, quizId);
  }
}

type RetainedSource = { s3Key: string; fileHash: string | null | undefined };

async function readRetainedSource(
  draftId: string,
  quizId: string,
  userId: string,
): Promise<RetainedSource> {
  const retainedDraft = await fetchQuizDraftServer(draftId, userId);
  if (!retainedDraft || !retainedDraft.pdf.retainedForPremium || !retainedDraft.pdf.s3Key) {
    throw new QuizDraftSynchronizationError(draftId, quizId);
  }
  return { s3Key: retainedDraft.pdf.s3Key, fileHash: retainedDraft.pdf.fileHash };
}

export const POST = withAuth(async (request: NextRequest, { params, userId, session }) => {
  try {
    const parsed = await parseParamsAndBody(request, params, {
      params: quizDraftIdRouteParamsSchema,
      body: submitQuizDraftRequestSchema,
    });
    if (!parsed.ok) return parsed.response;

    const { id } = parsed.params;
    const { title, folderId, description, questions, submitToPremium } = parsed.body;
    const premiumService = getPremiumQuizService();
    if (submitToPremium) {
      await premiumService.assertCanContribute(userId);
    }
    const warnings = getQuestionListWarnings(questions.length);

    // Idempotency guard: if the draft was already submitted (e.g. a retried
    // request after a flaky mark, or a double click), reuse the existing Quiz
    // instead of creating a duplicate. The draft is the source of truth for
    // which Quiz it produced.
    const existingDraft = await fetchQuizDraftServer(id, userId);
    if (existingDraft?.status === 'submitted' && existingDraft.submittedQuizId) {
      const existing = await quizService.getQuizById(
        existingDraft.submittedQuizId,
        userId,
        session.user.role,
      );
      if (existing.success && existing.data) {
        if (submitToPremium) {
          // RIN-1413: a failed first submission set the quiz public again.
          // Save it private first, like the first submit, or the new
          // submission could never be approved (RIN-1346).
          const privatized = await quizService.updateQuiz(
            existingDraft.submittedQuizId,
            { submitToPremium: true },
            userId,
            session.user.role,
          );
          if (!privatized.success) return apiServiceErr(privatized);
          await premiumService.submitSavedQuiz(userId, {
            quizId: existingDraft.submittedQuizId,
            rightsAttested: true,
            ...(existingDraft.pdf.fileHash
              ? { documentFingerprint: existingDraft.pdf.fileHash }
              : {}),
            ...(existingDraft.pdf.retainedForPremium && existingDraft.pdf.s3Key
              ? { sourceObjectKey: existingDraft.pdf.s3Key }
              : {}),
          });
        }
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
      submitToPremium,
    });

    const quizId = quiz.id;
    let retainedSource: RetainedSource | null = null;
    try {
      await markDraftSubmitted(id, quizId, userId, session.user.role, submitToPremium);
      if (submitToPremium) retainedSource = await readRetainedSource(id, quizId, userId);
    } catch (error) {
      // RIN-1413: the quiz was saved private for Premium but never reached a
      // submission; set it public again, then answer as before.
      if (submitToPremium) await premiumService.restorePublicWithoutSubmission(quizId);
      throw error;
    }
    if (retainedSource) {
      await premiumService.submitSavedQuiz(userId, {
        quizId,
        rightsAttested: true,
        sourceObjectKey: retainedSource.s3Key,
        ...(retainedSource.fileHash ? { documentFingerprint: retainedSource.fileHash } : {}),
      });
    }

    return apiOk({
      quizId,
      slug: quiz.slug,
      warnings,
    });
  } catch (error) {
    logger.error({ error }, 'Submit draft error');
    const authoringRefusal = quizAuthoringErrorResponse(error);
    if (authoringRefusal) return authoringRefusal;
    if (error instanceof QuizDraftSynchronizationError) {
      return apiErr('upstream_error', error.message, 502, {
        draftId: error.draftId,
        quizId: error.quizId,
        upstreamStatus: error.upstreamStatus,
      });
    }
    return apiErr('internal_error', 'Failed to submit draft', 500);
  }
});
