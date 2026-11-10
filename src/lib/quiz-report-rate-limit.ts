import 'server-only';

import crypto from 'node:crypto';

import {
  createRateLimiterRegistry,
  type RateLimitOutcome,
  type RateLimitWindow,
} from '@/lib/rate-limit-core';

/**
 * Ceilings for the anonymous "Report this quiz" form (RIN-1343). Stored in
 * `auth_rate_limits` under a `quiz-report:` prefix to reuse that collection's
 * deployed TTL/key indexes instead of new production DDL.
 */
type QuizReportRateLimitAction = 'per_address' | 'per_address_quiz';

const DEFAULTS: Record<QuizReportRateLimitAction, RateLimitWindow> = {
  per_address: { points: 5, durationSec: 60 * 60 },
  per_address_quiz: { points: 1, durationSec: 24 * 60 * 60 },
};

const registry = createRateLimiterRegistry<QuizReportRateLimitAction>(
  { collection: 'auth_rate_limits', keyPrefix: 'quiz-report:', envPrefix: 'QUIZ_REPORT_RATE' },
  DEFAULTS,
);

/**
 * Consumes both budgets; the first one exhausted wins. The per-quiz budget is
 * checked first so a repeat on one quiz does not also spend the hourly one.
 */
export async function consumeQuizReportRateLimit(
  ipHash: string,
  slug: string,
): Promise<RateLimitOutcome> {
  const perQuiz = await registry.consume('per_address_quiz', `${ipHash}:${slug}`);
  if (!perQuiz.allowed) return perQuiz;
  return registry.consume('per_address', ipHash);
}

/** The first proxy-reported address, as the audit helper reads it. */
function requestAddress(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return headers.get('x-real-ip')?.trim() || forwarded || 'unknown';
}

/**
 * HMAC of the caller's address, keyed by AUTH_SECRET with a purpose prefix so
 * the value matches no other hash in the system. The address itself is never
 * stored or logged.
 */
export function hashReporterAddress(headers: Headers): string {
  const secret = process.env['AUTH_SECRET'];
  if (!secret) throw new Error('AUTH_SECRET is required to hash reporter addresses');
  return crypto
    .createHmac('sha256', secret)
    .update(`quiz-report:v1:${requestAddress(headers)}`)
    .digest('base64url');
}
