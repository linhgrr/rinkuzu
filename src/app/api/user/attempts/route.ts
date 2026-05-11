import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk } from '@/lib/api/response';

const userService = serviceFactory.getUserService();

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return apiErr('unauthorized', 'Authentication required', 401);
    }

    // Get pagination parameters from URL
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const result = await userService.getUserAttempts(session.user.email, { page, limit });

    return apiOk({
      attempts: result.attempts,
      pagination: result.pagination,
    });
  } catch (error: unknown) {
    console.error('Get user attempts error:', error);
    const message = error instanceof Error ? error.message : '';

    if (message === 'User not found') {
      return apiErr('not_found', message, 404);
    }

    return apiErr('internal_error', 'Internal server error', 500);
  }
}
