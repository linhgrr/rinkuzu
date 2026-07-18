import { NextRequest } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { withAuth } from '@/lib/api/auth';
import { getQuizPdfObjectPrefix, s3Client, BUCKET_NAME } from '@/lib/s3';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { readAndValidateJson } from '@/lib/api/request';
import { createPresignedUploadUrlRequestSchema } from '@/dtos/storage';

export const dynamic = 'force-dynamic';

const URL_EXPIRES_IN_SECONDS = 300; // 5 minutes

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  try {
    const input = await readAndValidateJson(request, createPresignedUploadUrlRequestSchema);
    if (!input.success) {
      return apiErr('validation_error', input.error, 400, input.fields);
    }

    let prefix = '';
    if (input.data.purpose === 'quiz') {
      prefix = getQuizPdfObjectPrefix(userId);
    } else if (input.data.purpose === 'adaptive') {
      prefix = `uploads/adaptive_pipeline/${userId}/`;
    } else {
      return apiErr('validation_error', 'Invalid purpose specified', 400);
    }

    const safeName = sanitizeFileName(input.data.fileName);
    const key = `${prefix}${Date.now()}-${safeName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: input.data.contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: URL_EXPIRES_IN_SECONDS });

    return apiOk({
      uploadUrl,
      s3Key: key,
      expiresIn: URL_EXPIRES_IN_SECONDS,
    });
  } catch (error: unknown) {
    logger.error({ error }, 'Failed to create presigned upload URL');
    return apiErr(
      'upstream_error',
      extractUnknownErrorMessage(error, 'Internal server error'),
      500,
    );
  }
});
