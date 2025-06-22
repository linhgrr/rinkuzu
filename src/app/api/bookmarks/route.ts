import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import Bookmark from '@/models/Bookmark';

// GET - Get all bookmarks for current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    const bookmarks = await Bookmark.find({ userEmail: session.user.email })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalItems = await Bookmark.countDocuments({ userEmail: session.user.email });
    const totalPages = Math.ceil(totalItems / limit);

    const pagination = {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };

    return NextResponse.json({
      success: true,
      data: bookmarks,
      pagination
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

    await connectDB();

    // Check if bookmark already exists
    const existingBookmark = await Bookmark.findOne({
      userEmail: session.user.email,
      'quiz.slug': quiz.slug,
      questionIndex
    });

    if (existingBookmark) {
      return NextResponse.json({
        success: false,
        error: 'Question already bookmarked'
      }, { status: 400 });
    }

    const bookmark = new Bookmark({
      userId: session.user.id || session.user.email,
      userEmail: session.user.email,
      quiz,
      question,
      questionIndex
    });

    await bookmark.save();

    return NextResponse.json({
      success: true,
      data: bookmark
    });
  } catch (error) {
    console.error('Error creating bookmark:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create bookmark' },
      { status: 500 }
    );
  }
} 