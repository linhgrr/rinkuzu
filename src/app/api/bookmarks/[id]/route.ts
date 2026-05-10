import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { AsyncRouteParams } from '@/types/next-route';
import { apiErr } from '@/lib/api/response';

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

    return NextResponse.json({
      success: true,
      message: 'Bookmark removed',
    });
  } catch (error: any) {
    console.error('Error removing bookmark:', error);

    if (error.message === 'Bookmark not found or unauthorized') {
      return apiErr('not_found', error.message, 404);
    }

    return apiErr('internal_error', 'Failed to remove bookmark', 500);
  }
}
