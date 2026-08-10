import { fetchApiData } from '@/lib/api/client';
import type { PresignedUploadUrlResponseDto } from '@/dtos/storage';

/**
 * PDF utility functions shared across create pages.
 */

export type PresignedPdfUploadResult = {
  s3Key: string;
};

export async function deletePendingPdfUpload(
  s3Key: string,
  purpose: 'quiz' | 'adaptive',
): Promise<void> {
  await fetchApiData('/api/storage/upload', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ s3Key, purpose }),
  });
}

/** Only delete when the processing API definitively rejected the request. */
export function shouldCleanupPendingPdfUpload(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('status' in error)) return false;
  const status = Number((error as { status?: unknown }).status);
  return Number.isInteger(status) && status >= 400 && status < 500 && status !== 408;
}

/** Get the page count of a readable, unencrypted PDF using pdf-lib. */
export async function getPdfPageCount(file: File): Promise<number> {
  const { PDFDocument } = await import('pdf-lib');
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const pageCount = pdf.getPageCount();
  if (pageCount < 1) throw new Error('PDF has no pages');
  return pageCount;
}

/**
 * Upload a PDF file to S3 via a presigned URL.
 * Returns the S3 key for the uploaded file.
 */
export async function uploadPdfViaPresignedUrl(file: File): Promise<PresignedPdfUploadResult> {
  const { uploadUrl, uploadMethod, uploadHeaders, uploadFields, s3Key } =
    await fetchApiData<PresignedUploadUrlResponseDto>('/api/storage/presigned-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || 'application/pdf',
        fileSize: file.size,
        purpose: 'quiz',
      }),
    });

  const usePut = uploadMethod === 'PUT';
  const body = usePut ? file : buildPresignedPostBody(uploadFields, file);

  const putResponse = await fetch(uploadUrl, {
    // EXTERNAL: R2 supports presigned PUT; legacy S3 POST payloads remain accepted.
    method: usePut ? 'PUT' : 'POST',
    ...(usePut ? { headers: uploadHeaders } : {}),
    body,
  });

  if (!putResponse.ok) {
    throw new Error(`Storage upload failed with status ${putResponse.status}`);
  }

  return { s3Key };
}

function buildPresignedPostBody(fields: Record<string, string>, file: File): FormData {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => formData.append(key, value));
  formData.append('file', file);
  return formData;
}

export async function createPdfObjectUrlFromUrl(url: string): Promise<string> {
  // EXTERNAL: object storage PDF fetch
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PDF fetch failed with status ${response.status}`);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
