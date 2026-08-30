import type { NextRequest } from 'next/server';
import type { ZodType } from 'zod';
import {
  premiumQuizIdParamsSchema,
  premiumSessionIdParamsSchema,
  premiumSubmissionIdParamsSchema,
} from '@/dtos/premium-quiz';
import { withAdmin, withAuth } from '@/lib/api/auth';
import { premiumQuizErrorResponse, PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';
import { apiOk } from '@/lib/api/response';
import { parseParamsAndBody, parseRouteParams } from '@/lib/api/validated';
import { logger } from '@/lib/logger';

/** Who is playing, and with what entitlement — the two things every premium call needs. */
export interface PremiumActor {
  readonly userId: string;
  readonly role: string;
}

/**
 * The envelope every premium quiz route answers in.
 *
 * Two obligations live here rather than in each route. Success carries
 * PREMIUM_PRIVATE_HEADERS, because this is paid content and a route that
 * forgets them lets a shared cache keep it. Failure goes through
 * premiumQuizErrorResponse, which maps the domain's refusals onto their real
 * statuses — a spent session is a 409, an unpaid one a 403 — and re-applies the
 * same headers. A route that omits either still returns 200 with the right body
 * on the happy path, so nothing about the omission is visible until it matters.
 */
async function premiumOk<TData>(
  logMessage: string,
  status: number,
  produce: () => Promise<TData>,
): Promise<Response> {
  try {
    return apiOk(await produce(), status, { headers: PREMIUM_PRIVATE_HEADERS });
  } catch (error) {
    logger.error({ error }, logMessage);
    return premiumQuizErrorResponse(error);
  }
}

/** An action on a play session already in progress: session id in the route, cursor or key in the body. */
export function withPremiumSessionAction<TBody, TData>(
  bodySchema: ZodType<TBody>,
  logMessage: string,
  run: (actor: PremiumActor, sessionId: string, body: TBody) => Promise<TData>,
): ReturnType<typeof withAuth<{ sessionId: string }>> {
  return withAuth<{ sessionId: string }>(
    async (request: NextRequest, { params, userId, session }): Promise<Response> => {
      const parsed = await parseParamsAndBody(request, params, {
        params: premiumSessionIdParamsSchema,
        body: bodySchema,
      });
      if (!parsed.ok) return parsed.response;
      return premiumOk(logMessage, 200, () =>
        run({ userId, role: session.user.role }, parsed.params.sessionId, parsed.body),
      );
    },
  );
}

/** Opening a session against a quiz: quiz id in the route, nothing in the body, 201 on success. */
export function withPremiumSessionStart<TData>(
  logMessage: string,
  run: (actor: PremiumActor, quizId: string) => Promise<TData>,
): ReturnType<typeof withAuth<{ id: string }>> {
  return withAuth<{ id: string }>(
    async (_request, { params, userId, session }): Promise<Response> => {
      const parsed = parseRouteParams(params, premiumQuizIdParamsSchema);
      if (!parsed.ok) return parsed.response;
      return premiumOk(logMessage, 201, () =>
        run({ userId, role: session.user.role }, parsed.data.id),
      );
    },
  );
}

/** A read of the caller's own premium standing: no route params, no body. */
export function withPremiumRead<TData>(
  logMessage: string,
  run: (userId: string) => Promise<TData>,
): ReturnType<typeof withAuth> {
  return withAuth(
    async (_request, { userId }): Promise<Response> =>
      premiumOk(logMessage, 200, () => run(userId)),
  );
}

/**
 * An operator reading one submission. Same envelope as the player-facing routes
 * on purpose: the submission carries the author's uploaded source, so an admin
 * response is no more cacheable than a player's.
 */
export function withPremiumSubmissionRead<TData>(
  logMessage: string,
  run: (submissionId: string) => Promise<TData>,
): ReturnType<typeof withAdmin<{ id: string }>> {
  return withAdmin<{ id: string }>(async (_request, { params }): Promise<Response> => {
    const parsed = parseRouteParams(params, premiumSubmissionIdParamsSchema);
    if (!parsed.ok) return parsed.response;
    return premiumOk(logMessage, 200, () => run(parsed.data.id));
  });
}
