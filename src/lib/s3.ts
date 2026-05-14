import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const DEFAULT_OBJECT_STORAGE_ENDPOINT_EXTERNAL =
  'https://objectstorageapi.ap-southeast-1.clawcloudrun.com';

function normalizeExternalEndpoint(endpoint: string | undefined): string {
  const raw = (endpoint || DEFAULT_OBJECT_STORAGE_ENDPOINT_EXTERNAL).trim().replace(/\/+$/, '');
  if (raw.includes('://')) return raw;
  return `https://${raw}`;
}

const OBJECT_STORAGE_PUBLIC_BASE_URL = normalizeExternalEndpoint(
  process.env['OBJECT_STORAGE_ENDPOINT_EXTERNAL'],
);
const OBJECT_STORAGE_REGION = process.env['OBJECT_STORAGE_REGION'] || 'ap-southeast-1';
const OBJECT_STORAGE_ADDRESSING_STYLE = (
  process.env['OBJECT_STORAGE_ADDRESSING_STYLE'] || 'path'
).toLowerCase();

const s3Client = new S3Client({
  endpoint: OBJECT_STORAGE_PUBLIC_BASE_URL,
  region: OBJECT_STORAGE_REGION,
  credentials: {
    accessKeyId: process.env['OBJECT_STORAGE_ACCESS_KEY'] || '',
    secretAccessKey: process.env['OBJECT_STORAGE_SECRET_KEY'] || '',
  },
  forcePathStyle: OBJECT_STORAGE_ADDRESSING_STYLE === 'path',
});

const BUCKET_NAME = process.env['OBJECT_STORAGE_BUCKET'] || 'rinkuzu-pdfs';

/**
 * Get a signed URL for accessing a PDF
 * @param key - The S3 object key
 * @param expiresIn - URL expiry time in seconds (default: 1 hour)
 * @returns Signed URL for the PDF
 */
export async function getSignedPDFUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ResponseContentDisposition: 'inline',
    ResponseContentType: 'application/pdf',
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Delete a PDF from S3
 * @param key - The S3 object key to delete
 */
export async function deletePDF(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

export { s3Client, BUCKET_NAME, OBJECT_STORAGE_PUBLIC_BASE_URL };
