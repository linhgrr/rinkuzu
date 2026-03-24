import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { authOptions } from '@/lib/auth';
import { s3Client, BUCKET_NAME } from '@/lib/s3';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const URL_EXPIRES_IN_SECONDS = 300; // 5 minutes

type UploadPurpose = 'quiz' | 'adaptive';

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const fileName = String(body?.fileName || '').trim();
    const contentType = String(body?.contentType || 'application/pdf').trim();
    const fileSize = Number(body?.fileSize || 0);
    const purpose = String(body?.purpose || '').trim() as UploadPurpose;

    if (!fileName) {
      return NextResponse.json({ success: false, error: 'fileName is required' }, { status: 400 });
    }

    if (contentType !== 'application/pdf') {
      return NextResponse.json({ success: false, error: 'Only PDF files are supported' }, { status: 400 });
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'Invalid file size (max 50MB)' }, { status: 400 });
    }

    let prefix = '';
    if (purpose === 'quiz') {
      prefix = 'uploads/quiz_extract';
    } else if (purpose === 'adaptive') {
      prefix = 'uploads/adaptive_pipeline';
    } else {
      return NextResponse.json({ success: false, error: 'Invalid purpose specified' }, { status: 400 });
    }

    const safeName = sanitizeFileName(fileName);
    const key = `${prefix}/${userId}/${Date.now()}-${safeName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType, // using contentType from request, mostly 'application/pdf'
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: URL_EXPIRES_IN_SECONDS });

    return NextResponse.json({
      success: true,
      data: {
        uploadUrl,
        s3Key: key,
        expiresIn: URL_EXPIRES_IN_SECONDS,
      },
    });
  } catch (error: any) {
    console.error('Failed to create presigned upload URL:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
