import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import { uploadImageToImgBB } from '@/services/imageUploadService';
import { apiErr, apiOk } from '@/lib/api/response';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return apiErr('unauthorized', 'Authentication required', 401);
    }

    const formData = await request.formData();
    const file = formData.get('avatar') as File | null;

    if (!file) {
      return apiErr('validation_error', 'No file provided', 400);
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return apiErr('validation_error', 'Only JPG, PNG, and WebP images are allowed', 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return apiErr('validation_error', 'File size must be less than 2MB', 400);
    }

    await connectDB();

    const user = await User.findOne({ email: session.user.email }).select('_id');
    if (!user) {
      return apiErr('not_found', 'User not found', 404);
    }

    const result = await uploadImageToImgBB(file, `avatar-${String(user._id)}`);

    await User.updateOne({ email: session.user.email }, { avatar: result.displayUrl });

    return NextResponse.json({
      success: true,
      data: { avatar: result.displayUrl },
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return apiErr('unauthorized', 'Authentication required', 401);
    }

    await connectDB();

    const user = await User.findOne({ email: session.user.email }).select('avatar');
    if (!user) {
      return apiErr('not_found', 'User not found', 404);
    }

    if (user.avatar) {
      await User.updateOne({ email: session.user.email }, { $unset: { avatar: 1 } });
    }

    return apiOk(null, 200, { message: 'Avatar removed' });
  } catch (error) {
    console.error('Delete avatar error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}
