import { extractApiErrorMessage } from '@/lib/api/error';

/**
 * PDF utility functions shared across create pages.
 */

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
export async function uploadPdfViaPresignedUrl(file: File): Promise<{ s3Key: string }> {
  const response = await fetch('/api/storage/presigned-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || 'application/pdf',
      fileSize: file.size,
      purpose: 'quiz',
    }),
  });

  const payload = await response.json();
  if (!response.ok || !payload?.success || !payload?.data?.uploadUrl || !payload?.data?.s3Key) {
    throw new Error(extractApiErrorMessage(payload, 'Failed to create upload URL'));
  }

  const putResponse = await fetch(payload.data.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/pdf',
    },
    body: file,
  });

  if (!putResponse.ok) {
    throw new Error(`Storage upload failed with status ${putResponse.status}`);
  }

  return { s3Key: payload.data.s3Key as string };
}
