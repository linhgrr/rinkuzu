import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';

const bookmarkService = serviceFactory.getBookmarkService();

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

    await bookmarkService.deleteBookmarkByUser(params.id, session.user.email);

    return NextResponse.json({
      success: true,
      message: 'Bookmark removed'
    });
  } catch (error: any) {
    console.error('Error removing bookmark:', error);
    
    if (error.message === 'Bookmark not found or unauthorized') {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 404 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to remove bookmark' },
      { status: 500 }
    );
  }
} 