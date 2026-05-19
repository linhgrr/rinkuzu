import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import { apiErr, apiOk } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_request, { email }) => {
  try {
    if (!email) {
      return apiErr('unauthorized', 'Authentication required', 401);
    }

    await connectDB();
    const user = await User.findOne({ email }).select(
      'email displayName bio avatar role createdAt subscription',
    );

    if (!user) {
      return apiErr('not_found', 'User not found', 404);
    }

    return apiOk({
      email: user.email,
      displayName: user.displayName || '',
      bio: user.bio || '',
      avatar: user.avatar || '',
      role: user.role,
      createdAt: user.createdAt,
      subscription: user.subscription,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

export const PUT = withAuth(async (request: NextRequest, { email }) => {
  try {
    if (!email) {
      return apiErr('unauthorized', 'Authentication required', 401);
    }

    const { displayName, bio } = await request.json();

    if (displayName !== undefined && displayName.length > 50) {
      return apiErr('validation_error', 'Display name must be at most 50 characters', 400);
    }

    if (bio !== undefined && bio.length > 160) {
      return apiErr('validation_error', 'Bio must be at most 160 characters', 400);
    }

    await connectDB();

    const updateData: Record<string, string> = {};
    if (displayName !== undefined) updateData['displayName'] = displayName.trim();
    if (bio !== undefined) updateData['bio'] = bio.trim();

    const user = await User.findOneAndUpdate({ email }, updateData, {
      new: true,
      select: 'email displayName bio avatar role createdAt',
    });

    if (!user) {
      return apiErr('not_found', 'User not found', 404);
    }

    return apiOk({
      email: user.email,
      displayName: user.displayName || '',
      bio: user.bio || '',
      avatar: user.avatar || '',
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
