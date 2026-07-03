import { fetchApiData } from '@/lib/api/client';
import type { PresignedUploadUrlResponseDto } from '@/dtos/storage';

/**
 * PDF utility functions shared across create pages.
 */

export type PresignedPdfUploadResult = {
  s3Key: string;
};

/** Get the page count of a PDF file using pdf-lib. */
export async function getPdfPageCount(file: File): Promise<number> {
  try {
    const { PDFDocument } = await import('pdf-lib');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    return pdf.getPageCount();
  } catch {
    return 1;
  }
}

/**
 * Upload a PDF file to S3 via a presigned URL.
 * Returns the S3 key for the uploaded file.
 */
export async function uploadPdfViaPresignedUrl(file: File): Promise<PresignedPdfUploadResult> {
  const { uploadUrl, s3Key } = await fetchApiData<PresignedUploadUrlResponseDto>(
    '/api/storage/presigned-url',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || 'application/pdf',
        fileSize: file.size,
        purpose: 'quiz',
      }),
    },
  );

  const putResponse = await fetch(uploadUrl, {
    // EXTERNAL: S3 presigned PUT
    method: 'PUT',
    headers: {
      'Content-Type': 'application/pdf',
    },
    body: file,
  });

  if (!putResponse.ok) {
    throw new Error(`Storage upload failed with status ${putResponse.status}`);
  }

  return { s3Key };
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
