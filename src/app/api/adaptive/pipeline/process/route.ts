import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { invalidateAdaptiveServiceCache } from '@/lib/adaptive/cache-policy';
import { resolveOwnedAdaptivePipelineS3Key } from '@/lib/adaptive/storage-key';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET_NAME } from '@/lib/s3';
import { apiErr } from '@/lib/api/response';
import { withAuth } from '@/lib/api/auth';
import { readAndValidateJson } from '@/lib/api/request';
import { adaptivePipelineProcessRequestSchema } from '@/dtos/adaptive-pipeline';
import { logger } from '@/lib/logger';
import type { components } from '@/generated/adaptive-api';

export const dynamic = 'force-dynamic';
type ApiSchemas = components['schemas'];

export const POST = withAuth(async (req, { userId, session }) => {
  try {
    const body = await readAndValidateJson(req, adaptivePipelineProcessRequestSchema);
    if (!body.success) {
      return apiErr('validation_error', body.error, 400, { issues: body.fields });
    }
    const { s3Key: clientS3Key, filename, subject_id, page_batch_size } = body.data;

    // Fail closed: never sign or forward a client key outside the auth user's namespace.
    const ownedKey = resolveOwnedAdaptivePipelineS3Key(clientS3Key, userId);
    if (!ownedKey.ok) {
      return apiErr('validation_error', ownedKey.error, 400);
    }
    const s3Key = ownedKey.key;

    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    // 1 hour expiration for the URL
    const file_url = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

    const proxiedBody = {
      file_url,
      filename,
      source_s3_key: s3Key,
      ...(subject_id ? { subject_id } : {}),
      page_batch_size,
      min_confidence: 0.6,
      apply_reduction: true,
    } satisfies ApiSchemas['ProcessDocumentRequest'];

    const response = await proxyAdaptiveRequest(
      req,
      '/pipeline/process',
      { userId, userRole: session.user.role },
      {
        method: 'POST',
        llmAction: 'adaptive_pipeline',
        body: JSON.stringify(proxiedBody),
        contentType: 'application/json',
        timeoutMs: 180_000,
      },
    );

    invalidateAdaptiveServiceCache();
    return response;
  } catch (error) {
    logger.error({ error }, 'Error proxying pipeline process request');
    return apiErr('internal_error', 'Internal server error while processing upload', 500);
  }
});
