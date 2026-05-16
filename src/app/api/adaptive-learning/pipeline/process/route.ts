import { proxyAdaptiveRequest } from '@/lib/adaptive-learning/proxy';
import { invalidateAdaptiveServiceCache } from '@/lib/adaptive-learning/cache-policy';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET_NAME } from '@/lib/s3';
import { apiErr } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { s3Key, filename, subject_id, page_batch_size } = body;

    if (!s3Key || typeof s3Key !== 'string') {
      return apiErr('validation_error', 'Missing s3Key', 400);
    }
    if (!filename || typeof filename !== 'string') {
      return apiErr('validation_error', 'Missing filename', 400);
    }

    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    // 1 hour expiration for the URL
    const file_url = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

    const proxiedBody = {
      file_url,
      filename,
      subject_id,
      ...(typeof page_batch_size === 'number' ? { page_batch_size } : {}),
    };

    const response = await proxyAdaptiveRequest(req, '/api/pipeline/process', {
      method: 'POST',
      body: JSON.stringify(proxiedBody),
      contentType: 'application/json',
      timeoutMs: 180_000,
    });

    invalidateAdaptiveServiceCache();
    return response;
  } catch (error) {
    console.error('Error proxying pipeline process request:', error);
    return apiErr('internal_error', 'Internal server error while processing upload', 500);
  }
}
