import { afterEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { getPdfPageCount, uploadPdfViaPresignedUrl } from '@/lib/pdf';

describe('PDF upload helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('counts readable PDF pages and rejects malformed input', async () => {
    const document = await PDFDocument.create();
    document.addPage();
    document.addPage();
    const bytes = await document.save();
    const pdfBuffer = Uint8Array.from(bytes).buffer;

    await expect(
      getPdfPageCount(new File([pdfBuffer], 'lesson.pdf', { type: 'application/pdf' })),
    ).resolves.toBe(2);
    await expect(
      getPdfPageCount(new File(['not-a-pdf'], 'broken.pdf', { type: 'application/pdf' })),
    ).rejects.toBeInstanceOf(Error);
  });

  it('uploads through a size-bound R2-compatible presigned PUT', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              uploadUrl: 'https://storage.example/upload',
              uploadMethod: 'PUT',
              uploadHeaders: { 'Content-Type': 'application/pdf' },
              uploadFields: {},
              s3Key: 'uploads/quiz_extract/user-1/source.pdf',
              expiresIn: 300,
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const file = new File(['%PDF-1.7'], 'source.pdf', { type: 'application/pdf' });
    await expect(uploadPdfViaPresignedUrl(file)).resolves.toEqual({
      s3Key: 'uploads/quiz_extract/user-1/source.pdf',
    });

    const uploadInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(uploadInit.method).toBe('PUT');
    expect(uploadInit.headers).toEqual({ 'Content-Type': 'application/pdf' });
    expect(uploadInit.body).toBe(file);
  });
});
