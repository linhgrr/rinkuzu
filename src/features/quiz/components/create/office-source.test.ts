import { describe, expect, it, vi } from 'vitest';

const { extractMock } = vi.hoisted(() => ({ extractMock: vi.fn() }));
vi.mock('@/lib/office-text', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/office-text')>()),
  extractOfficeText: extractMock,
}));

import {
  CREATE_FILE_ACCEPT,
  OFFICE_MAX_FILE_MB,
  createFileKind,
  getOfficeRefusalMessage,
  readOfficeFile,
  titleFromFileName,
} from './office-source';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const file = (name: string, type = '') => new File(['x'], name, { type });

describe('CREATE_FILE_ACCEPT', () => {
  it('maps each MIME type to its extension, so a file with no type is still accepted', () => {
    expect(CREATE_FILE_ACCEPT).toEqual({
      'application/pdf': ['.pdf'],
      [DOCX]: ['.docx'],
      [PPTX]: ['.pptx'],
      'application/msword': ['.doc'],
      'application/vnd.ms-powerpoint': ['.ppt'],
    });
  });
});

describe('createFileKind', () => {
  it.each([
    ['notes.pdf', '', 'pdf'],
    ['NOTES.PDF', '', 'pdf'],
    ['scan', 'application/pdf', 'pdf'],
    ['notes.docx', '', 'office'],
    ['Slides.PPTX', '', 'office'],
    ['no-extension', DOCX, 'office'],
    ['no-extension', PPTX, 'office'],
    ['old.doc', '', 'legacy'],
    ['old.ppt', '', 'legacy'],
    ['no-extension', 'application/msword', 'legacy'],
    ['notes.txt', 'text/plain', 'other'],
    ['noext', '', 'other'],
  ] as const)('%s (%s) is %s', (name, type, kind) => {
    expect(createFileKind(file(name, type))).toBe(kind);
  });
});

describe('titleFromFileName', () => {
  it.each([
    ['Chapter 1.docx', 'Chapter 1'],
    ['Week 3.PPTX', 'Week 3'],
    ['notes.pdf', 'notes'],
    ['notes.v2.docx', 'notes.v2'],
    ['a.docx.txt', 'a.docx.txt'],
  ])('%s becomes %s', (name, title) => {
    expect(titleFromFileName(name)).toBe(title);
  });
});

describe('readOfficeFile', () => {
  it('returns the extracted text, file type and truncation flag', async () => {
    extractMock.mockResolvedValueOnce({
      ok: true,
      text: 'Fake text',
      fileType: 'pptx',
      truncated: true,
    });

    await expect(readOfficeFile(file('deck.pptx', PPTX))).resolves.toEqual({
      ok: true,
      source: { text: 'Fake text', fileType: 'pptx', truncated: true },
    });
  });

  it('passes the reason of a refused file through', async () => {
    extractMock.mockResolvedValueOnce({ ok: false, reason: 'encrypted' });

    await expect(readOfficeFile(file('locked.docx', DOCX))).resolves.toEqual({
      ok: false,
      reason: 'encrypted',
    });
  });

  it('reads a MIME-only file under a name that ends in its type', async () => {
    extractMock.mockResolvedValueOnce({
      ok: true,
      text: 'Fake',
      fileType: 'docx',
      truncated: false,
    });

    await readOfficeFile(file('shared-from-phone', DOCX));

    expect(extractMock.mock.calls.at(-1)?.[0].name).toBe('shared-from-phone.docx');
  });

  it('refuses a legacy file without reading it', async () => {
    extractMock.mockClear();

    await expect(readOfficeFile(file('old.ppt', 'application/vnd.ms-powerpoint'))).resolves.toEqual(
      {
        ok: false,
        reason: 'legacy_format',
      },
    );
    expect(extractMock).not.toHaveBeenCalled();
  });
});

describe('getOfficeRefusalMessage', () => {
  const t = (key: string, values?: Record<string, string | number>) =>
    values ? `${key}:${JSON.stringify(values)}` : key;

  it.each([
    ['too_large', `officeTooLarge:${JSON.stringify({ size: OFFICE_MAX_FILE_MB })}`],
    ['legacy_format', 'officeLegacyFormat'],
    ['encrypted', 'officeEncrypted'],
    ['corrupt', 'officeCorrupt'],
    ['too_little_text', 'officeTooLittleText'],
    ['wrong_type', 'pdfWrongType'],
  ] as const)('%s uses %s', (reason, message) => {
    expect(getOfficeRefusalMessage(reason, t, OFFICE_MAX_FILE_MB)).toBe(message);
  });

  it('states the 20 MB limit', () => {
    expect(OFFICE_MAX_FILE_MB).toBe(20);
  });
});
