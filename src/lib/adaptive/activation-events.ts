import 'server-only';

import { z } from 'zod';

import type { AdminAdaptiveLearnerEvents } from '@/interfaces/repositories/IAdminStatsRepository';
import { proxyAdaptiveRequest } from './proxy';

/**
 * Server-side client for the API's `GET /admin/activation/adaptive-events`
 * (RIN-669): per-learner Path B events that the activation stats merge with
 * the web's quiz data. Called with the service token and `x-user-role: admin`
 * through the adaptive proxy; never exposed to the browser.
 */

const TARGET_PATH = '/admin/activation/adaptive-events';
/** The stats answer quiz-only rather than wait longer than this. */
const ADAPTIVE_EVENTS_TIMEOUT_MS = 2_000;

// An instant with a zone designator, or a naive one the API means as UTC.
const ZONED_INSTANT = /(?:Z|[+-]\d{2}:?\d{2})$/i;
/** An API instant as a `Date`; also used by the review-facts client (RIN-1364). */
export const instantSchema = z
  .string()
  .transform((value) => new Date(ZONED_INSTANT.test(value) ? value : `${value}Z`))
  .refine((date) => !Number.isNaN(date.getTime()), 'invalid instant');

const learnerSchema = z.object({
  user_id: z.string(),
  first_completion_at: instantSchema.nullable(),
  completions: z.array(instantSchema),
  succeeded_uploads: z.array(instantSchema),
});

const envelopeSchema = z.object({
  success: z.literal(true),
  data: z.object({ learners: z.array(learnerSchema) }),
});

/** Thrown with a message that never carries response content or user data. */
class AdaptiveEventsUnavailableError extends Error {
  constructor(reason: string) {
    super(`adaptive activation events unavailable: ${reason}`);
    this.name = 'AdaptiveEventsUnavailableError';
  }
}

/**
 * Events in `[from, to)`. `actorId` is the admin reading the stats, or the
 * all-zero service id. Throws `AdaptiveEventsUnavailableError` on any
 * non-2xx, timeout or malformed body.
 */
export async function fetchAdaptiveActivationEvents(
  from: Date,
  to: Date,
  actorId: string,
): Promise<AdminAdaptiveLearnerEvents[]> {
  const url = new URL(`http://internal/api/adaptive${TARGET_PATH}`);
  url.searchParams.set('from', from.toISOString());
  url.searchParams.set('to', to.toISOString());
  const response = await proxyAdaptiveRequest(
    new Request(url, { method: 'GET' }),
    TARGET_PATH,
    { userId: actorId, userRole: 'admin' },
    { method: 'GET', timeoutMs: ADAPTIVE_EVENTS_TIMEOUT_MS },
  );
  if (!response.ok) throw new AdaptiveEventsUnavailableError(`status ${response.status}`);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AdaptiveEventsUnavailableError('body is not JSON');
  }
  const parsed = envelopeSchema.safeParse(payload);
  if (!parsed.success) throw new AdaptiveEventsUnavailableError('unexpected body shape');
  return parsed.data.data.learners.map((learner) => ({
    userId: learner.user_id,
    firstCompletionAt: learner.first_completion_at,
    completions: learner.completions,
    succeededUploads: learner.succeeded_uploads,
  }));
}
