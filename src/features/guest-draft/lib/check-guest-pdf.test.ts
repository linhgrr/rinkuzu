import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPdfPageCount } = vi.hoisted(() => ({ getPdfPageCount: vi.fn() }));
vi.mock('@/lib/pdf', () => ({ getPdfPageCount }));

import { checkGuestPdf, GUEST_FILE_ACCEPT, guestOfficeFile } from './check-guest-pdf';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const MB = 1024 * 1024;

function file(name: string, type = '', bytes = 10) {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('checkGuestPdf (RIN-1448, RIN-1786)', () => {
  beforeEach(() => {
    getPdfPageCount.mockReset();
    getPdfPageCount.mockResolvedValue(5);
  });

  it('keeps the PDF rules: 4 MB, 10 pages, unreadable passes', async () => {
    expect(await checkGuestPdf(file('a.pdf', 'application/pdf'))).toBe('ok');
    expect(await checkGuestPdf(file('a.pdf', '', 4 * MB + 1))).toBe('too_large');
    getPdfPageCount.mockResolvedValueOnce(11);
    expect(await checkGuestPdf(file('a.pdf'))).toBe('too_large');
    getPdfPageCount.mockRejectedValueOnce(new Error('encrypted'));
    expect(await checkGuestPdf(file('a.pdf'))).toBe('ok');
  });

  it.each([
    ['notes.docx', ''],
    ['deck.pptx', ''],
    ['Lecture', DOCX_MIME],
    ['Deck', PPTX_MIME],
  ])('accepts %s (%s) up to 20 MB without reading pages', async (name, type) => {
    expect(await checkGuestPdf(file(name, type, 20 * MB))).toBe('ok');
    expect(getPdfPageCount).not.toHaveBeenCalled();
  });

  it('refuses an office file over 20 MB with its own result', async () => {
    expect(await checkGuestPdf(file('big.docx', DOCX_MIME, 20 * MB + 1))).toBe('office_too_large');
  });

  it.each([
    ['old.doc', ''],
    ['old.PPT', ''],
    ['x', 'application/msword'],
    ['x', 'application/vnd.ms-powerpoint'],
  ])('sends %s (%s) to the legacy-format message', async (name, type) => {
    expect(await checkGuestPdf(file(name, type))).toBe('legacy_format');
  });

  it('refuses anything else as not a PDF', async () => {
    expect(await checkGuestPdf(file('photo.png', 'image/png'))).toBe('not_pdf');
    expect(await checkGuestPdf(file('noextension'))).toBe('not_pdf');
  });
});

describe('guestOfficeFile', () => {
  it('keeps a file whose name already ends in its type', () => {
    const docx = file('notes.DOCX');
    expect(guestOfficeFile(docx)).toEqual({ file: docx, type: 'docx' });
  });

  it('renames a file known only by its MIME type', () => {
    const result = guestOfficeFile(file('Deck', PPTX_MIME));
    expect(result?.type).toBe('pptx');
    expect(result?.file.name).toBe('Deck.pptx');
  });

  it('is null for a PDF, a legacy file or an unknown one', () => {
    expect(guestOfficeFile(file('a.pdf', 'application/pdf'))).toBeNull();
    expect(guestOfficeFile(file('a.doc'))).toBeNull();
    expect(guestOfficeFile(file('a.png', 'image/png'))).toBeNull();
  });
});

describe('GUEST_FILE_ACCEPT', () => {
  it('lists the PDF, Word and PowerPoint types and extensions, and the legacy ones', () => {
    expect(GUEST_FILE_ACCEPT.split(',')).toEqual(
      expect.arrayContaining(['.pdf', '.docx', '.pptx', '.doc', '.ppt', DOCX_MIME, PPTX_MIME]),
    );
  });
});
