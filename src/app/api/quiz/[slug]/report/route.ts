import type { NextRequest } from 'next/server';

import { getQuizPageReportService, getQuizService } from '@/lib/quiz-factory';
import {
  quizSlugRouteParamsSchema,
  reportQuizPageRequestSchema,
  reportQuizRequestSchema,
} from '@/dtos/quiz';
import { createQuizSlugMutationRoute } from '@/app/api/quiz/[slug]/mutation-route';
import { withOptionalAuth } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { parseParamsAndBody } from '@/lib/api/validated';
import { logger } from '@/lib/logger';
import { consumeQuizReportRateLimit, hashReporterAddress } from '@/lib/quiz-report-rate-limit';

/** Per-question report from the player: signed-in only, unchanged by RIN-1343. */
const reportQuestion = createQuizSlugMutationRoute({
  schema: reportQuizRequestSchema,
  execute: ({ slug, input, email, session }) =>
    getQuizService().reportQuiz(
      slug,
      input.questionId,
      input.content,
      email,
      session.user.name || email,
      session,
    ),
  successMeta: { message: 'Report submitted successfully' },
  logMessage: 'Error submitting report',
  publicErrorMessage: 'Internal server error',
});

/** "Report this quiz" from the quiz page: open to anyone (RIN-1343). */
const reportQuizPage = withOptionalAuth<{ slug: string }>(async (request, { params, session }) => {
  try {
    const parsed = await parseParamsAndBody(request, params, {
      params: quizSlugRouteParamsSchema,
      body: reportQuizPageRequestSchema,
    });
    if (!parsed.ok) return parsed.response;
    const { slug } = parsed.params;
    const { website, reason, details, email } = parsed.body;

    // A filled honeypot is a bot: answer as if it worked and keep nothing.
    if (website) return apiOk({ reportId: null }, 200);

    const ipHash = hashReporterAddress(request.headers);
    const rateLimit = await consumeQuizReportRateLimit(ipHash, slug);
    if (!rateLimit.allowed) {
      return apiErr('rate_limit_exceeded', 'Too many reports. Try again later.', 429, {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        limit: rateLimit.limit,
      });
    }

    const sessionEmail = session?.user?.email ?? undefined;
    const reporterEmail = sessionEmail ?? email;
    const reporterName = session?.user?.name ?? sessionEmail;
    const result = await getQuizPageReportService().report(slug, {
      reason,
      ipHash,
      ...(details ? { details } : {}),
      ...(reporterEmail ? { reporterEmail } : {}),
      ...(reporterName ? { reporterName } : {}),
    });
    return result.success ? apiOk(result.data, 201) : apiServiceErr(result);
  } catch (error) {
    logger.error({ error }, 'Error submitting quiz page report');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

function isPerQuestionBody(body: unknown): boolean {
  return typeof body === 'object' && body !== null && ('questionId' in body || 'content' in body);
}

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const body: unknown = await request
    .clone()
    .json()
    .catch(() => null);
  return isPerQuestionBody(body)
    ? reportQuestion(request, context)
    : reportQuizPage(request, context);
}
