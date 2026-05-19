import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { NextRequest } from 'next/server';
import { apiErr } from './response';

type WithAuthOptions = {
  role?: string;
};

type RouteParams = Record<string, string | string[]>;

type AuthContext<TParams extends RouteParams = RouteParams> = {
  userId: string;
  email: string;
  session: Session;
  params: TParams;
};

type RouteHandler<TParams extends RouteParams = RouteParams> = (
  request: NextRequest,
  context: AuthContext<TParams>,
) => Promise<Response>;

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
    routeContext: { params: Promise<TParams> },
  ): Promise<Response> => {
    const session = await getServerSession(await getAuthOptions());

    if (!session?.user) {
      return apiErr('unauthorized', 'Unauthorized', 401);
    }

    const userId = session.user?.id;
    const email = session.user?.email;

    if (!userId && !email) {
      return apiErr('unauthorized', 'Unauthorized', 401);
    }

    if (options?.role) {
      const userRole = session.user?.role;
      if (userRole !== options.role) {
        const roleLabel = options.role === 'admin' ? 'Admin' : options.role;
        return apiErr('forbidden', `${roleLabel} access required`, 403);
      }
    }

    const params = await routeContext.params;

    return handler(request, {
      userId: userId || '',
      email: email || '',
      session,
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
