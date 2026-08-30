import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { deletePendingUploadRequestSchema } from '@/dtos/storage';
import { resolveOwnedAdaptivePipelineS3Key } from '@/lib/adaptive/storage-key';
import { BUCKET_NAME, getQuizPdfObjectPrefix, s3Client } from '@/lib/s3';
import { logger } from '@/lib/logger';
import { parseJsonBody } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

export const DELETE = withAuth(async (request, { userId }) => {
  const input = await parseJsonBody(request, deletePendingUploadRequestSchema);
  if (!input.ok) return input.response;

  const { purpose, s3Key } = input.data;
  const ownedKey =
    purpose === 'adaptive'
      ? resolveOwnedAdaptivePipelineS3Key(s3Key, userId)
      : s3Key.startsWith(getQuizPdfObjectPrefix(userId))
        ? { ok: true as const, key: s3Key }
        : { ok: false as const, error: 'Upload key is not owned by the current user' };

  if (!ownedKey.ok) {
    return apiErr('validation_error', ownedKey.error, 400);
  }

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: ownedKey.key,
      }),
    );
    return apiOk({ deleted: true });
  } catch (error) {
    logger.error({ error, userId, s3Key: ownedKey.key }, 'Failed to clean pending PDF upload');
    return apiErr('upstream_error', 'Failed to clean pending upload', 502);
  }
});
