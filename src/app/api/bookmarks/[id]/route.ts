import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { AsyncRouteParams } from '@/types/next-route';
import { apiErr, apiOk } from '@/lib/api/response';

const bookmarkService = serviceFactory.getBookmarkService();

// DELETE - Remove bookmark
export async function DELETE(request: NextRequest, { params }: AsyncRouteParams<{ id: string }>) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return apiErr('unauthorized', 'Unauthorized', 401);
    }

    await bookmarkService.deleteBookmarkByUser(id, session.user.email);

    return apiOk(null, 200, { meta: { message: 'Bookmark removed' } });
  } catch (error: unknown) {
    console.error('Error removing bookmark:', error);

    if (error instanceof Error && error.message === 'Bookmark not found or unauthorized') {
      return apiErr('not_found', error.message, 404);
    }

    return apiErr('internal_error', 'Failed to remove bookmark', 500);
  }
}
