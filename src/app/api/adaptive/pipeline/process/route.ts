import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { invalidateAdaptiveServiceCache } from '@/lib/adaptive/cache-policy';
import { resolveOwnedAdaptivePipelineS3Key } from '@/lib/adaptive/storage-key';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET_NAME } from '@/lib/s3';
import { apiErr } from '@/lib/api/response';
import { withAuth } from '@/lib/api/auth';
import { adaptivePipelineProcessRequestSchema } from '@/dtos/adaptive-pipeline';
import { logger } from '@/lib/logger';
import type { components } from '@/generated/adaptive-api';
import { getConstraint, resolveEntitlements } from '@/lib/entitlements';
import { parseJsonBody } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';
type ApiSchemas = components['schemas'];

export const POST = withAuth(async (req, { userId, session }) => {
  try {
    const body = await parseJsonBody(req, adaptivePipelineProcessRequestSchema);
    if (!body.ok) return body.response;
    const { s3Key: clientS3Key, filename, subject_id, page_batch_size } = body.data;

    // Fail closed: never sign or forward a client key outside the auth user's namespace.
    const ownedKey = resolveOwnedAdaptivePipelineS3Key(clientS3Key, userId);
    if (!ownedKey.ok) {
      return apiErr('validation_error', ownedKey.error, 400);
    }
    const s3Key = ownedKey.key;
    const entitlements = await resolveEntitlements(userId);
    const pdfPageLimit = getConstraint(
      session.user.role === 'admin' ? { tier: 'premium' } : entitlements,
      'adaptive_pdf_pages',
    );

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
        internalHeaders: { 'x-rinkuzu-pdf-page-limit': String(pdfPageLimit) },
      },
    );

    invalidateAdaptiveServiceCache();
    return response;
  } catch (error) {
    logger.error({ error }, 'Error proxying pipeline process request');
    return apiErr('internal_error', 'Internal server error while processing upload', 500);
  }
});
