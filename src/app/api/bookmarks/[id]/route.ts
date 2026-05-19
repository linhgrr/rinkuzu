import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk } from '@/lib/api/response';

const bookmarkService = serviceFactory.getBookmarkService();

// DELETE - Remove bookmark
export const DELETE = withAuth<{ id: string }>(async (_request: NextRequest, { params, email }) => {
  try {
    const { id } = params;
    if (!email) {
      return apiErr('unauthorized', 'Unauthorized', 401);
    }

    await bookmarkService.deleteBookmarkByUser(id, email);

    return apiOk(null, 200, { meta: { message: 'Bookmark removed' } });
  } catch (error: unknown) {
    console.error('Error removing bookmark:', error);

    if (error instanceof Error && error.message === 'Bookmark not found or unauthorized') {
      return apiErr('not_found', error.message, 404);
    }

    return apiErr('internal_error', 'Failed to remove bookmark', 500);
  }
});
