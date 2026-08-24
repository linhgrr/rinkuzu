// Hybrid submit: the Quiz lives in the Next/Mongoose domain, while
// the draft lifecycle is owned by FastAPI. So we create
// the Quiz here from the editor's questions, then tell FastAPI to mark the
// draft submitted (which also cleans up the source PDF).
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { getQuizService } from '@/lib/quiz-factory';
import { apiErr, apiOk } from '@/lib/api/response';
import { readAndValidateJson, readAndValidateRouteParams } from '@/lib/api/request';
import { submitQuizDraftRequestSchema } from '@/dtos/quiz-draft';
import { quizDraftIdRouteParamsSchema } from '@/dtos/quiz';
import { getQuestionListWarnings } from '@/lib/validation/question';
import { fetchQuizDraftServer } from '@/lib/quiz/draftServer';
import { logger } from '@/lib/logger';
import { QuizCreationError, QuizDraftSynchronizationError } from '@/lib/quiz/errors';
import {
  buildAdaptiveServiceHeaders,
  buildAdaptiveUrl,
  resolveAdaptiveProxyTimeoutMs,
} from '@/lib/adaptive/config';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { premiumQuizErrorResponse } from '@/lib/api/premium-quiz';

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

export const POST = withAuth(async (request: NextRequest, { params, userId, session }) => {
  try {
    const parsedParams = readAndValidateRouteParams(params, quizDraftIdRouteParamsSchema);
    if (!parsedParams.success) {
      return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
    }

    const { id } = parsedParams.data;
    const input = await readAndValidateJson(request, submitQuizDraftRequestSchema);
    if (!input.success) {
      return apiErr('validation_error', input.error, 400, {
        fields: input.fields,
      });
    }
    const { title, folderId, description, questions, submitToPremium } = input.data;
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
          await premiumService.createSubmission(userId, {
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
    await markDraftSubmitted(id, quizId, userId, session.user.role, submitToPremium);
    if (submitToPremium) {
      const retainedDraft = await fetchQuizDraftServer(id, userId);
      if (!retainedDraft || !retainedDraft.pdf.retainedForPremium || !retainedDraft.pdf.s3Key) {
        throw new QuizDraftSynchronizationError(id, quizId);
      }
      await premiumService.createSubmission(userId, {
        quizId,
        rightsAttested: true,
        sourceObjectKey: retainedDraft.pdf.s3Key,
        ...(retainedDraft.pdf.fileHash ? { documentFingerprint: retainedDraft.pdf.fileHash } : {}),
      });
    }

    return apiOk({
      quizId,
      slug: quiz.slug,
      warnings,
    });
  } catch (error) {
    logger.error({ error }, 'Submit draft error');
    if (error instanceof Error && error.name === 'PremiumQuizError') {
      return premiumQuizErrorResponse(error);
    }
    if (error instanceof QuizCreationError) {
      const status = error.code === 'premium_required' ? 403 : 400;
      const code = error.code === 'premium_required' ? 'premium_required' : 'validation_error';
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
});
