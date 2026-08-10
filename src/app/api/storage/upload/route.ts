import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { readAndValidateJson } from '@/lib/api/request';
import { deletePendingUploadRequestSchema } from '@/dtos/storage';
import { resolveOwnedAdaptivePipelineS3Key } from '@/lib/adaptive/storage-key';
import { BUCKET_NAME, getQuizPdfObjectPrefix, s3Client } from '@/lib/s3';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const DELETE = withAuth(async (request, { userId }) => {
  const input = await readAndValidateJson(request, deletePendingUploadRequestSchema);
  if (!input.success) {
    return apiErr('validation_error', input.error, 400, { fields: input.fields });
  }

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
