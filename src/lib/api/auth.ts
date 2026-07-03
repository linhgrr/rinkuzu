import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { NextRequest } from 'next/server';
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

let authOptionsPromise: Promise<Awaited<ReturnType<typeof loadAuthOptions>>> | null = null;

async function loadAuthOptions() {
  const mod = await import('@/lib/auth');
  return mod.authOptions;
}

async function getAuthOptions() {
  if (!authOptionsPromise) {
    authOptionsPromise = loadAuthOptions();
  }

  return authOptionsPromise;
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
    const session = await getServerSession(await getAuthOptions());

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
 * calling `getServerSession(authOptions)` inline. Keeps every route on the
 * same auth boundary even when auth itself is optional.
 */
export function withOptionalAuth<TParams extends RouteParams = RouteParams>(
  handler: OptionalAuthHandler<TParams>,
) {
  return async (
    request: NextRequest,
    routeContext: RouteContextParams<TParams>,
  ): Promise<Response> => {
    const [session, params] = await Promise.all([
      getServerSession(await getAuthOptions()),
      routeContext.params,
    ]);

    return handler(request, {
      userId: session?.user?.id ?? null,
      email: session?.user?.email ?? null,
      session: session ?? null,
      params,
    });
  };
}
