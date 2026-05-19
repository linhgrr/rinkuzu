import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import { apiErr, apiOk } from '@/lib/api/response';

const IMGBB_API_URL = 'https://api.imgbb.com/1/upload';
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const PUT = withAuth(async (request: NextRequest, { email }) => {
  try {
    if (!email) {
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

    const user = await User.findOne({ email }).select('_id');
    if (!user) {
      return apiErr('not_found', 'User not found', 404);
    }

    const apiKey = process.env['IMGBB_API_KEY'];
    if (!apiKey) {
      return apiErr('configuration_error', 'Image upload not configured', 500);
    }

    const upstream = new FormData();
    upstream.append('key', apiKey);
    upstream.append('image', file, `avatar-${String(user._id)}`);

    const imgbbRes = await fetch(IMGBB_API_URL, {
      method: 'POST',
      body: upstream,
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
    const imgbbJson = (await imgbbRes.json()) as {
      success: boolean;
      data?: { display_url: string };
    };

    if (!imgbbRes.ok || !imgbbJson.success || !imgbbJson.data) {
      return apiErr('upstream_error', 'Image upload failed', 502);
    }

    const avatarUrl = imgbbJson.data.display_url;
    await User.updateOne({ email }, { avatar: avatarUrl });

    return apiOk({ avatar: avatarUrl });
  } catch (error) {
    console.error('Upload avatar error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

export const DELETE = withAuth(async (_request, { email }) => {
  try {
    if (!email) {
      return apiErr('unauthorized', 'Authentication required', 401);
    }

    await connectDB();

    const user = await User.findOne({ email }).select('avatar');
    if (!user) {
      return apiErr('not_found', 'User not found', 404);
    }

    if (user.avatar) {
      await User.updateOne({ email }, { $unset: { avatar: 1 } });
    }

    return apiOk(null, 200, { meta: { message: 'Avatar removed' } });
  } catch (error) {
    console.error('Delete avatar error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
