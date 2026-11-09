import 'server-only';

import { z } from 'zod';

import { proxyAdaptiveRequest } from './proxy';

/**
 * Server-side client for the API's
 * `GET /admin/review-reminder/adaptive/{user_id}?after=` (RIN-1361): the facts
 * the Path B review email needs (RIN-1364). Called with the service token and
 * `x-user-role: admin` through the adaptive proxy; never exposed to the browser.
 */

const TARGET_PREFIX = '/admin/review-reminder/adaptive';
/** The opt-in and the sender answer "unavailable" rather than wait longer than this. */
const REVIEW_FACTS_TIMEOUT_MS = 2_000;
/** The service actor: no admin is reading anything. */
const SERVICE_ACTOR_ID = '000000000000000000000000';

// An instant with a zone designator, or a naive one the API means as UTC.
const ZONED_INSTANT = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const instantSchema = z
  .string()
  .transform((value) => new Date(ZONED_INSTANT.test(value) ? value : `${value}Z`))
  .refine((date) => !Number.isNaN(date.getTime()), 'invalid instant');

const completionSchema = z.object({
  completed_at: instantSchema,
  document_id: z.string().min(1).max(128).nullable(),
  document_title: z.string().nullable(),
  due_count: z.number().int().nonnegative(),
});

const envelopeSchema = z.object({
  success: z.literal(true),
  data: z.object({
    latest_completion: completionSchema.nullable(),
    completions_after: z.array(instantSchema),
  }),
});

/** The learner's latest adaptive completion: one document reaching a 5-exercise mark. */
export interface AdaptiveCompletion {
  completedAt: Date;
  /** Adaptive session id (route `/adaptive/subject/{id}`); null when the progress has none. */
  documentId: string | null;
  documentTitle: string | null;
  /** Concepts whose latest answered exercise was wrong. */
  dueCount: number;
}

export interface AdaptiveReviewFacts {
  latestCompletion: AdaptiveCompletion | null;
  /** Completions strictly after `after` (empty when it was not asked). */
  completionsAfter: Date[];
}

/** Thrown with a message that never carries response content or user data. */
export class AdaptiveReviewFactsUnavailableError extends Error {
  constructor(reason: string) {
    super(`adaptive review facts unavailable: ${reason}`);
    this.name = 'AdaptiveReviewFactsUnavailableError';
  }
}

async function requestFacts(userId: string, after: Date | undefined): Promise<Response> {
  const targetPath = `${TARGET_PREFIX}/${encodeURIComponent(userId)}`;
  const url = new URL(`http://internal/api/adaptive${targetPath}`);
  if (after) url.searchParams.set('after', after.toISOString());
  // The proxy answers a timeout or network failure with an error status, never a throw.
  return proxyAdaptiveRequest(
    new Request(url, { method: 'GET' }),
    targetPath,
    { userId: SERVICE_ACTOR_ID, userRole: 'admin' },
    { method: 'GET', timeoutMs: REVIEW_FACTS_TIMEOUT_MS },
  );
}

/**
 * Review facts for one learner. Throws `AdaptiveReviewFactsUnavailableError`
 * on any non-2xx, timeout or malformed body, so callers never act blind.
 */
export async function fetchAdaptiveReviewFacts(
  userId: string,
  after?: Date,
): Promise<AdaptiveReviewFacts> {
  const response = await requestFacts(userId, after);
  if (!response.ok) throw new AdaptiveReviewFactsUnavailableError(`status ${response.status}`);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AdaptiveReviewFactsUnavailableError('body is not JSON');
  }
  const parsed = envelopeSchema.safeParse(payload);
  if (!parsed.success) throw new AdaptiveReviewFactsUnavailableError('unexpected body shape');
  const { latest_completion: latest, completions_after: completionsAfter } = parsed.data.data;
  return {
    latestCompletion: latest
      ? {
          completedAt: latest.completed_at,
          documentId: latest.document_id,
          documentTitle: latest.document_title,
          dueCount: latest.due_count,
        }
      : null,
    completionsAfter,
  };
}
