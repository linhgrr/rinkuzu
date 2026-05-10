import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import { s3Client, BUCKET_NAME, OBJECT_STORAGE_PUBLIC_BASE_URL } from '@/lib/s3';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { apiErr } from '@/lib/api/response';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function getExtension(contentType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  return map[contentType] || 'jpg';
}

function extractS3Key(avatarUrl: string): string | null {
  if (!avatarUrl) return null;
  const bucketPrefix = `/${BUCKET_NAME}/`;
  const idx = avatarUrl.indexOf(bucketPrefix);
  if (idx !== -1) {
    return avatarUrl.substring(idx + bucketPrefix.length);
  }
  if (avatarUrl.startsWith('avatars/')) {
    return avatarUrl;
  }
  return null;
}

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

    const user = await User.findOne({ email: session.user.email }).select('_id avatar');
    if (!user) {
      return apiErr('not_found', 'User not found', 404);
    }

    // Delete old avatar if exists
    if (user.avatar) {
      const oldKey = extractS3Key(user.avatar);
      if (oldKey) {
        try {
          await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: oldKey }));
        } catch {
          // Ignore delete errors for old avatar
        }
      }
    }

    const ext = getExtension(file.type);
    const key = `avatars/${user._id}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        ContentDisposition: 'inline',
      }),
    );

    const avatarUrl = `${OBJECT_STORAGE_PUBLIC_BASE_URL}/${BUCKET_NAME}/${key}`;

    await User.updateOne({ email: session.user.email }, { avatar: avatarUrl });

    return NextResponse.json({
      success: true,
      data: { avatar: avatarUrl },
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
      const key = extractS3Key(user.avatar);
      if (key) {
        try {
          await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
        } catch {
          // Ignore delete errors
        }
      }
      await User.updateOne({ email: session.user.email }, { $unset: { avatar: 1 } });
    }

    return NextResponse.json({
      success: true,
      message: 'Avatar removed',
    });
  } catch (error) {
    console.error('Delete avatar error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}
