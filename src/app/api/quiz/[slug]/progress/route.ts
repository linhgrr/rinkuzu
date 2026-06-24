import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiOk, apiErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';

type Answer = number | number[];

interface SaveProgressPayload {
  questionOrder?: unknown;
  optionOrders?: unknown;
  userAnswers?: unknown;
  currentQuestionIndex?: unknown;
  answeredCount?: unknown;
  totalQuestions?: unknown;
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number');
}

function isAnswerArray(value: unknown): value is Answer[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'number' ||
        (Array.isArray(item) && item.every((inner) => typeof inner === 'number')),
    )
  );
}

async function resolveQuizId(slug: string): Promise<string | null> {
  const quiz = await serviceFactory.getQuizRepository().findBySlug(slug);
  return quiz?._id ? String(quiz._id) : null;
}

export const GET = withAuth<{ slug: string }>(async (_request: NextRequest, { params, userId }) => {
  try {
    const quizId = await resolveQuizId(params.slug);
    if (!quizId) {
      return apiErr('not_found', 'Quiz not found', 404);
    }

    const repo = serviceFactory.getQuizProgressRepository();
    const progress = await repo.findByUserAndQuiz(userId, quizId);

    return apiOk({ progress: progress ?? null });
  } catch (error) {
    logger.error({ error }, 'Get quiz progress error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

export const PUT = withAuth<{ slug: string }>(async (request: NextRequest, { params, userId }) => {
  try {
    const quizId = await resolveQuizId(params.slug);
    if (!quizId) {
      return apiErr('not_found', 'Quiz not found', 404);
    }

    const payload = (await request.json()) as SaveProgressPayload;

    if (
      !isNumberArray(payload.questionOrder) ||
      !Array.isArray(payload.optionOrders) ||
      !payload.optionOrders.every(isNumberArray) ||
      !isAnswerArray(payload.userAnswers) ||
      typeof payload.currentQuestionIndex !== 'number' ||
      typeof payload.answeredCount !== 'number' ||
      typeof payload.totalQuestions !== 'number'
    ) {
      return apiErr('validation_error', 'Invalid progress payload', 400);
    }

    if (
      payload.questionOrder.length !== payload.totalQuestions ||
      payload.userAnswers.length !== payload.totalQuestions ||
      payload.optionOrders.length !== payload.totalQuestions
    ) {
      return apiErr('validation_error', 'Progress payload length mismatch', 400);
    }

    const repo = serviceFactory.getQuizProgressRepository();
    await repo.upsert(userId, quizId, {
      questionOrder: payload.questionOrder,
      optionOrders: payload.optionOrders as number[][],
      userAnswers: payload.userAnswers,
      currentQuestionIndex: payload.currentQuestionIndex,
      answeredCount: payload.answeredCount,
      totalQuestions: payload.totalQuestions,
    });

    return apiOk({ saved: true });
  } catch (error) {
    logger.error({ error }, 'Save quiz progress error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

export const DELETE = withAuth<{ slug: string }>(
  async (_request: NextRequest, { params, userId }) => {
    try {
      const quizId = await resolveQuizId(params.slug);
      if (!quizId) {
        return apiErr('not_found', 'Quiz not found', 404);
      }

      const repo = serviceFactory.getQuizProgressRepository();
      await repo.deleteByUserAndQuiz(userId, quizId);

      return apiOk({ deleted: true });
    } catch (error) {
      logger.error({ error }, 'Delete quiz progress error');
      return apiErr('internal_error', 'Internal server error', 500);
    }
  },
);
