import { NextRequest } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { withAuth } from '@/lib/api/auth';
import { s3Client, BUCKET_NAME } from '@/lib/s3';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { apiErr, apiOk } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const URL_EXPIRES_IN_SECONDS = 300; // 5 minutes

type UploadPurpose = 'quiz' | 'adaptive';

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  try {
    const body = await request.json();
    const fileName = String(body?.fileName || '').trim();
    const contentType = String(body?.contentType || 'application/pdf').trim();
    const fileSize = Number(body?.fileSize || 0);
    const purpose = String(body?.purpose || '').trim() as UploadPurpose;

    if (!fileName) {
      return apiErr('validation_error', 'fileName is required', 400);
    }

    if (contentType !== 'application/pdf') {
      return apiErr('validation_error', 'Only PDF files are supported', 400);
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
      return apiErr('validation_error', 'Invalid file size (max 50MB)', 400);
    }

    let prefix = '';
    if (purpose === 'quiz') {
      prefix = 'uploads/quiz_extract';
    } else if (purpose === 'adaptive') {
      prefix = 'uploads/adaptive_pipeline';
    } else {
      return apiErr('validation_error', 'Invalid purpose specified', 400);
    }

    const safeName = sanitizeFileName(fileName);
    const key = `${prefix}/${userId}/${Date.now()}-${safeName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType, // using contentType from request, mostly 'application/pdf'
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: URL_EXPIRES_IN_SECONDS });

    return apiOk({
      uploadUrl,
      s3Key: key,
      expiresIn: URL_EXPIRES_IN_SECONDS,
    });
  } catch (error: unknown) {
    console.error('Failed to create presigned upload URL:', error);
    return apiErr(
      'upstream_error',
      extractUnknownErrorMessage(error, 'Internal server error'),
      500,
    );
  }
});
