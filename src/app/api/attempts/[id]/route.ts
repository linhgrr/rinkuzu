import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { AsyncRouteParams } from '@/types/next-route';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';

export async function GET(request: NextRequest, { params }: AsyncRouteParams<{ id: string }>) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');

    // Check if user is authenticated or has userEmail
    if (!session?.user?.email && !userEmail) {
      return apiErr('unauthorized', 'Authentication required or userEmail parameter', 401);
    }

    const userService = serviceFactory.getUserService();

    // Use session email if available, otherwise use userEmail from params
    const email = session?.user?.email ?? userEmail;
    if (!email) {
      return apiErr('unauthorized', 'Authentication required or userEmail parameter', 401);
    }
    const result = await userService.getAttemptDetails(id, email);

    if (!result.success) {
      return apiServiceErr(result, 400);
    }

    return apiOk(result.data);
  } catch (error: unknown) {
    console.error('Get attempt details error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}
