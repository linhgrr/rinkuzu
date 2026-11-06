import { describe, expect, it } from 'vitest';
import type { FileRejection } from 'react-dropzone';
import enCreate from '@/../messages/en/create.json';
import viCreate from '@/../messages/vi/create.json';
import { getPdfRejectionMessage, isPdfFile } from './pdf-file-error';

// RIN-991: a .txt pick showed "We could not read this PDF ... corrupted", the
// same banner as a broken PDF, so learners could not tell what to fix.

const translatorFor =
  (messages: typeof enCreate) =>
  (key: string, values?: Record<string, string | number>): string =>
    String(messages[key as keyof typeof enCreate]).replace(/\{(\w+)\}/g, (_, name: string) =>
      String(values?.[name] ?? ''),
    );

function rejection(name: string, type: string, code: string): FileRejection {
  return {
    file: new File(['x'], name, { type }),
    errors: [{ code, message: 'dropzone message' }],
  };
}

describe('getPdfRejectionMessage', () => {
  it('names the file type for a non-PDF pick in en and vi', () => {
    const rejections = [rejection('notes.txt', 'text/plain', 'file-invalid-type')];

    expect(getPdfRejectionMessage(rejections, translatorFor(enCreate), 100)).toBe(
      'Only PDF files are supported. Choose a .pdf file.',
    );
    expect(getPdfRejectionMessage(rejections, translatorFor(viCreate), 100)).toBe(
      viCreate.pdfWrongType,
    );
    expect(viCreate.pdfWrongType).not.toBe(enCreate.pdfWrongType);
  });

  it('keeps the size message for a file that is too large', () => {
    const rejections = [rejection('big.pdf', 'application/pdf', 'file-too-large')];

    expect(getPdfRejectionMessage(rejections, translatorFor(enCreate), 100)).toBe(
      'This file exceeds 100MB. Compress the PDF or reduce image quality and try again.',
    );
  });

  it('falls back to the unreadable message for any other rejection', () => {
    const rejections = [rejection('a.pdf', 'application/pdf', 'too-many-files')];

    expect(getPdfRejectionMessage(rejections, translatorFor(enCreate), 100)).toBe(
      enCreate.pdfUnreadable,
    );
  });
});

describe('isPdfFile', () => {
  it.each([
    ['doc.pdf', 'application/pdf', true],
    ['DOC.PDF', '', true],
    ['scan.pdf', 'application/octet-stream', true],
    ['notes.txt', 'text/plain', false],
    ['photo.png', 'image/png', false],
  ])('%s (%s) -> %s', (name, type, expected) => {
    expect(isPdfFile(new File(['x'], name, { type }))).toBe(expected);
  });
});
