import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import Bookmark from '@/models/Bookmark';

// DELETE - Remove bookmark
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const bookmark = await Bookmark.findOneAndDelete({
      _id: params.id,
      userEmail: session.user.email
    });

    if (!bookmark) {
      return NextResponse.json({
        success: false,
        error: 'Bookmark not found or unauthorized'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Bookmark removed'
    });
  } catch (error) {
    console.error('Error removing bookmark:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove bookmark' },
      { status: 500 }
    );
  }
} 