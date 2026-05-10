import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { apiErr } from './response';

type WithAuthOptions = {
  role?: string;
};

type AuthContext = {
  userId: string;
  email: string;
  session: any;
};

type RouteHandler<T = any> = (
  request: T,
  context: AuthContext & { params?: any },
) => Promise<Response>;

/**
 * Wraps an API route handler with authentication and optional role check.
 * Returns 401 if not authenticated, 403 if wrong role.
 * Provides userId, email, and session to the handler.
 */
export function withAuth(handler: RouteHandler<NextRequest>, options?: WithAuthOptions) {
  return async (request: NextRequest, routeContext?: { params?: any }) => {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return apiErr('unauthorized', 'Unauthorized', 401);
    }

    const userId = (session.user as any)?.id;
    const email = session.user?.email;

    if (!userId && !email) {
      return apiErr('unauthorized', 'Unauthorized', 401);
    }

    if (options?.role) {
      const userRole = (session.user as any)?.role;
      if (userRole !== options.role) {
        const roleLabel = options.role === 'admin' ? 'Admin' : options.role;
        return apiErr('forbidden', `${roleLabel} access required`, 403);
      }
    }

    return handler(request, {
      userId,
      email: email || '',
      session,
      params: routeContext?.params,
    });
  };
}

/**
 * Convenience wrapper for admin-only routes.
 */
export function withAdmin(handler: RouteHandler<NextRequest>) {
  return withAuth(handler, { role: 'admin' });
}
