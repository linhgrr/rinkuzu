import { afterEach, describe, expect, it, vi } from 'vitest';

import { reportDropzoneRejection, reportUploadRejection } from '@/lib/upload-rejection-client';
import { uploadExtension, uploadSizeBucket } from '@/shared/constants/upload-counters';

const MB = 1024 * 1024;

async function sentBody(beacon: ReturnType<typeof vi.fn>): Promise<unknown> {
  const blob = beacon.mock.calls[0]?.[1] as Blob;
  return JSON.parse(await blob.text());
}

describe('upload counter helpers (RIN-1785)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('derives the extension and the size bucket, never the name', () => {
    expect(uploadExtension('Notes.DOCX')).toBe('docx');
    expect(uploadExtension('archive.tar.gz')).toBe('gz');
    expect(uploadExtension('no-extension')).toBe('other');
    expect(uploadExtension('weird.ex t')).toBe('other');
    expect(uploadSizeBucket(MB - 1)).toBe('<1MB');
    expect(uploadSizeBucket(MB)).toBe('1-5MB');
    expect(uploadSizeBucket(5 * MB)).toBe('5-20MB');
    expect(uploadSizeBucket(20 * MB)).toBe('5-20MB');
    expect(uploadSizeBucket(20 * MB + 1)).toBe('>20MB');
  });

  it('sends the four allow-list fields with sendBeacon', async () => {
    const beacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    reportUploadRejection({
      file: { name: 'private-name.docx', size: 2 * MB },
      reason: 'wrong_type',
      surface: 'create_pdf',
    });
    expect(beacon).toHaveBeenCalledWith('/api/upload-rejections', expect.any(Blob));
    expect(await sentBody(beacon)).toEqual({
      ext: 'docx',
      reason: 'wrong_type',
      surface: 'create_pdf',
      sizeBucket: '1-5MB',
    });
  });

  it('never throws, with or without sendBeacon', () => {
    const report = () =>
      reportUploadRejection({
        file: { name: 'a', size: 1 },
        reason: 'corrupt',
        surface: 'try_pdf',
      });
    vi.stubGlobal('navigator', {});
    expect(report).not.toThrow();
    vi.stubGlobal('navigator', {
      sendBeacon: () => {
        throw new Error('boom');
      },
    });
    expect(report).not.toThrow();
  });

  it('maps a dropzone refusal to its reason', async () => {
    const beacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    const file = new File(['x'], 'a.docx');
    reportDropzoneRejection([{ file, errors: [{ code: 'file-invalid-type' }] }], 'adaptive_upload');
    expect(await sentBody(beacon)).toMatchObject({
      reason: 'wrong_type',
      surface: 'adaptive_upload',
    });
    beacon.mockClear();
    reportDropzoneRejection([{ file, errors: [{ code: 'file-too-large' }] }], 'adaptive_upload');
    expect(await sentBody(beacon)).toMatchObject({ reason: 'too_large' });
    beacon.mockClear();
    reportDropzoneRejection([], 'adaptive_upload');
    expect(beacon).not.toHaveBeenCalled();
  });
});
