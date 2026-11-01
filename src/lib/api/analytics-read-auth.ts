import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { withAdmin } from './auth';

/**
 * Read-only bearer credential for ground-truth analytics.
 *
 * It unlocks only the routes that wrap themselves in
 * `withAnalyticsReadOrAdmin` (today: `/api/admin/stats/activation`). `withAdmin`
 * itself never looks at it, so every other admin route still answers 401 to a
 * token-only request.
 */
const ANALYTICS_READ_TOKEN_ENV = 'ANALYTICS_READ_TOKEN';

type AnalyticsReadActor = { kind: 'admin'; userId: string; email: string } | { kind: 'service' };

type AnalyticsReadHandler = (request: NextRequest, actor: AnalyticsReadActor) => Promise<Response>;

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  const match = header ? /^Bearer\s+(\S+)\s*$/i.exec(header) : null;
  return match?.[1] ?? null;
}

/**
 * True only when the env var holds a non-empty value and the request's bearer
 * token equals it. Both sides are hashed first so `timingSafeEqual` always
 * compares equal-length buffers and the comparison leaks neither content nor
 * length. An unset or empty env var disables token access entirely.
 */
function hasValidAnalyticsReadToken(request: NextRequest): boolean {
  const expected = process.env[ANALYTICS_READ_TOKEN_ENV]?.trim();
  if (!expected) return false;
  const provided = bearerToken(request);
  if (!provided) return false;
  return timingSafeEqual(sha256(provided), sha256(expected));
}

/**
 * Route-local auth: a valid analytics token first, otherwise the normal admin
 * session check (401 unauthenticated, 403 non-admin).
 */
export function withAnalyticsReadOrAdmin(handler: AnalyticsReadHandler) {
  const adminHandler = withAdmin((request, context) =>
    handler(request, { kind: 'admin', userId: context.userId, email: context.email }),
  );
  return async (
    request: NextRequest,
    routeContext: { params: Promise<Record<string, string | string[]>> },
  ): Promise<Response> => {
    if (hasValidAnalyticsReadToken(request)) return handler(request, { kind: 'service' });
    return adminHandler(request, routeContext);
  };
}
