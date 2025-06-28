import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';

const bookmarkService = serviceFactory.getBookmarkService();

// GET - Get all bookmarks for current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    const result = await bookmarkService.getBookmarksByUser(session.user.email, { page, limit });

    return NextResponse.json({
      success: true,
      data: result.bookmarks,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bookmarks' },
      { status: 500 }
    );
  }
}

// POST - Create new bookmark
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { quiz, question, questionIndex } = body;

    const bookmark = await bookmarkService.createBookmark(session.user.email, {
      quiz,
      question,
      questionIndex
    });

    return NextResponse.json({
      success: true,
      data: bookmark
    });
  } catch (error: any) {
    console.error('Error creating bookmark:', error);
    
    if (error.message === 'Question already bookmarked') {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 400 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create bookmark' },
      { status: 500 }
    );
  }
} 