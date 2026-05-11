import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk } from '@/lib/api/response';

const bookmarkService = serviceFactory.getBookmarkService();

// GET - Get all bookmarks for current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return apiErr('unauthorized', 'Unauthorized', 401);
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    const result = await bookmarkService.getBookmarksByUser(session.user.email, { page, limit });

    return apiOk({
      bookmarks: result.bookmarks,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    return apiErr('internal_error', 'Failed to fetch bookmarks', 500);
  }
}

// POST - Create new bookmark
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return apiErr('unauthorized', 'Unauthorized', 401);
    }

    const body = await request.json();
    const { quiz, question, questionIndex } = body;

    const bookmark = await bookmarkService.createBookmark(session.user.email, {
      quiz,
      question,
      questionIndex,
    });

    return apiOk(bookmark);
  } catch (error: unknown) {
    console.error('Error creating bookmark:', error);
    const message = error instanceof Error ? error.message : '';

    if (message === 'Question already bookmarked') {
      return apiErr('validation_error', message, 400);
    }

    return apiErr('internal_error', 'Failed to create bookmark', 500);
  }
}
