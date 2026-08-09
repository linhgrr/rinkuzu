import type { Session } from 'next-auth';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { apiErr } from './response';

type WithAuthOptions = {
  role?: string;
};

type RouteParams = Record<string, string | string[]>;

type AuthenticatedSession = Session & {
  user: NonNullable<Session['user']>;
};

type AuthContext<TParams extends RouteParams = RouteParams> = {
  userId: string;
  email: string;
  session: AuthenticatedSession;
  params: TParams;
};

type RouteHandler<TParams extends RouteParams = RouteParams> = (
  request: NextRequest,
  context: AuthContext<TParams>,
) => Promise<Response>;

interface RouteContextParams<TParams extends RouteParams = RouteParams> {
  params: Promise<TParams>;
}

/**
 * Wraps an API route handler with authentication and optional role check.
 * Returns 401 if not authenticated, 403 if wrong role.
 * Provides userId, email, and session to the handler.
 */
export function withAuth<TParams extends RouteParams = RouteParams>(
  handler: RouteHandler<TParams>,
  options?: WithAuthOptions,
) {
  return async (
    request: NextRequest,
    routeContext: RouteContextParams<TParams>,
  ): Promise<Response> => {
    const session = await auth();

    if (!session?.user) {
      return apiErr('unauthorized', 'Unauthorized', 401);
    }

    const authenticatedSession: AuthenticatedSession = {
      ...session,
      user: session.user,
    };

    const userId = authenticatedSession.user.id;
    const email = authenticatedSession.user.email;

    if (!userId || !email) {
      return apiErr('unauthorized', 'Unauthorized', 401);
    }

    if (options?.role) {
      const userRole = authenticatedSession.user.role;
      if (userRole !== options.role) {
        const roleLabel = options.role === 'admin' ? 'Admin' : options.role;
        return apiErr('forbidden', `${roleLabel} access required`, 403);
      }
    }

    const params = await routeContext.params;

    return handler(request, {
      userId,
      email,
      session: authenticatedSession,
      params,
    });
  };
}

/**
 * Convenience wrapper for admin-only routes.
 */
export function withAdmin<TParams extends RouteParams = RouteParams>(
  handler: RouteHandler<TParams>,
) {
  return withAuth(handler, { role: 'admin' });
}

function configuredLlmAdminIds(): ReadonlySet<string> {
  return new Set(
    (process.env['LLM_CONFIG_ADMIN_USER_IDS'] ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function isJsonMutation(request: NextRequest): boolean {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  return contentType.startsWith('application/json');
}

function isStrictSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  return origin === new URL(request.url).origin && fetchSite === 'same-origin';
}

/**
 * Stronger boundary for the LLM configuration control plane.
 *
 * Reads use the normal admin role guard. Mutations additionally require the
 * browser's exact same-origin signals and JSON content type. Production can
 * narrow access further with a comma-separated LLM_CONFIG_ADMIN_USER_IDS list.
 */
export function withLlmConfigAdmin<TParams extends RouteParams = RouteParams>(
  handler: RouteHandler<TParams>,
) {
  return withAdmin<TParams>(async (request, context) => {
    const allowlist = configuredLlmAdminIds();
    if (
      process.env.NODE_ENV === 'production' &&
      allowlist.size > 0 &&
      !allowlist.has(context.userId)
    ) {
      return apiErr('forbidden', 'LLM configuration access required', 403);
    }

    if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) {
      if (!isStrictSameOrigin(request) || !isJsonMutation(request)) {
        return apiErr('forbidden', 'Same-origin JSON request required', 403);
      }
    }

    return handler(request, context);
  });
}

type OptionalAuthContext<TParams extends RouteParams = RouteParams> = {
  userId: string | null;
  email: string | null;
  session: Session | null;
  params: TParams;
};

type OptionalAuthHandler<TParams extends RouteParams = RouteParams> = (
  request: NextRequest,
  context: OptionalAuthContext<TParams>,
) => Promise<Response>;

/**
 * Wraps a route that supports BOTH authenticated and anonymous access.
 *
 * Use this for endpoints where the response shape changes based on whether
 * a session exists (e.g. public quiz play, anonymous attempts) instead of
 * resolving the Auth.js session inline. Keeps every route on the
 * same auth boundary even when auth itself is optional.
 */
export function withOptionalAuth<TParams extends RouteParams = RouteParams>(
  handler: OptionalAuthHandler<TParams>,
) {
  return async (
    request: NextRequest,
    routeContext: RouteContextParams<TParams>,
  ): Promise<Response> => {
    const [session, params] = await Promise.all([auth(), routeContext.params]);

    return handler(request, {
      userId: session?.user?.id ?? null,
      email: session?.user?.email ?? null,
      session: session ?? null,
      params,
    });
  };
}
