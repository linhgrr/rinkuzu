import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email }).select(
      'email displayName bio avatar role createdAt subscription',
    );

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        email: user.email,
        displayName: user.displayName || '',
        bio: user.bio || '',
        avatar: user.avatar || '',
        role: user.role,
        createdAt: user.createdAt,
        subscription: user.subscription,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    const { displayName, bio } = await request.json();

    if (displayName !== undefined && displayName.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Display name must be at most 50 characters' },
        { status: 400 },
      );
    }

    if (bio !== undefined && bio.length > 160) {
      return NextResponse.json(
        { success: false, error: 'Bio must be at most 160 characters' },
        { status: 400 },
      );
    }

    await connectDB();

    const updateData: Record<string, string> = {};
    if (displayName !== undefined) updateData.displayName = displayName.trim();
    if (bio !== undefined) updateData.bio = bio.trim();

    const user = await User.findOneAndUpdate({ email: session.user.email }, updateData, {
      new: true,
      select: 'email displayName bio avatar role createdAt',
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        email: user.email,
        displayName: user.displayName || '',
        bio: user.bio || '',
        avatar: user.avatar || '',
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
