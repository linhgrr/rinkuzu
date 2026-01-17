import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// S3-compatible storage configuration
const s3Client = new S3Client({
    endpoint: process.env.S3_ENDPOINT || 'https://objectstorageapi.ap-southeast-1.clawcloudrun.com',
    region: 'ap-southeast-1',
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || '',
    },
    forcePathStyle: true, // Required for path-style addressing
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'rinkuzu-pdfs';

/**
 * Upload a PDF file to S3
 * @param fileBuffer - The file buffer to upload
 * @param key - The S3 object key (path/filename)
 * @param contentType - The content type (default: application/pdf)
 * @returns The S3 URL of the uploaded file
 */
export async function uploadPDF(
    fileBuffer: Buffer,
    key: string,
    contentType: string = 'application/pdf'
): Promise<string> {
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        ContentDisposition: 'inline',
    });

    await s3Client.send(command);

    // Return the public URL
    const endpoint = process.env.S3_ENDPOINT || 'https://objectstorageapi.ap-southeast-1.clawcloudrun.com';
    return `${endpoint}/${BUCKET_NAME}/${key}`;
}

/**
 * Upload a PDF from base64 string
 * @param base64Data - Base64 encoded PDF data (with or without data URI prefix)
 * @param key - The S3 object key
 * @returns The S3 URL of the uploaded file
 */
export async function uploadPDFFromBase64(
    base64Data: string,
    key: string
): Promise<string> {
    // Remove data URI prefix if present
    const base64Content = base64Data.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(base64Content, 'base64');
    return uploadPDF(buffer, key);
}

/**
 * Get PDF buffer from S3
 * @param key - The S3 object key
 * @returns PDF as Buffer
 */
export async function getPDFBuffer(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new Error('Empty response from S3');
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as any) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Get a signed URL for accessing a PDF
 * @param key - The S3 object key
 * @param expiresIn - URL expiry time in seconds (default: 1 hour)
 * @returns Signed URL for the PDF
 */
export async function getSignedPDFUrl(
    key: string,
    expiresIn: number = 3600
): Promise<string> {
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

/**
 * Generate a unique key for a PDF file
 * @param userId - User ID
 * @param originalFilename - Original filename
 * @returns Unique S3 key
 */
export function generatePDFKey(userId: string, originalFilename: string): string {
    const timestamp = Date.now();
    const sanitizedFilename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `pdfs/${userId}/${timestamp}-${sanitizedFilename}`;
}

export { s3Client, BUCKET_NAME };
