import { NextRequest } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { withAuth } from '@/lib/api/auth';
import { getQuizPdfObjectPrefix, s3Client, BUCKET_NAME } from '@/lib/s3';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { createPresignedUploadUrlRequestSchema } from '@/dtos/storage';
import { resolveEntitlements, type MeteredCapability } from '@/lib/entitlements';
import { getLlmUsageSnapshot } from '@/lib/llm/rate-limit';
import { checkAuthRateLimit, rateLimitResponse } from '@/lib/auth-rate-limit';
import { parseJsonBody } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

const URL_EXPIRES_IN_SECONDS = 300; // 5 minutes

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

const UPLOAD_CAPABILITY: Record<'quiz' | 'adaptive', MeteredCapability> = {
  quiz: 'quiz_extract',
  adaptive: 'adaptive_pipeline',
};

export const POST = withAuth(async (request: NextRequest, { userId, session }) => {
  try {
    const input = await parseJsonBody(request, createPresignedUploadUrlRequestSchema);
    if (!input.ok) return input.response;

    const uploadRate = await checkAuthRateLimit('pdf_upload_intent_user', userId);
    if (!uploadRate.allowed) return rateLimitResponse(uploadRate);

    if (session.user.role !== 'admin') {
      const entitlements = await resolveEntitlements(userId);
      const capability = UPLOAD_CAPABILITY[input.data.purpose];
      const windows = await getLlmUsageSnapshot(userId, capability, entitlements);
      const exhausted = windows.find((window) => window.remaining <= 0);
      if (exhausted) {
        return apiErr('quota_exceeded', 'Usage quota exceeded', 429, {
          capability,
          tier: entitlements.tier,
          upgradeEligible: entitlements.tier === 'free',
          windows: Object.fromEntries(
            windows.map((window) => [
              window.window,
              {
                used: window.count,
                limit: window.limit,
                remaining: window.remaining,
                resetAt: window.resetAt.toISOString(),
              },
            ]),
          ),
        });
      }
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
      ContentLength: input.data.fileSize,
    });
    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: URL_EXPIRES_IN_SECONDS,
    });

    return apiOk({
      uploadUrl,
      uploadMethod: 'PUT' as const,
      uploadHeaders: { 'Content-Type': input.data.contentType },
      uploadFields: {},
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
