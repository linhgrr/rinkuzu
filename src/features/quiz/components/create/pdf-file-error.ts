import type { FileRejection } from 'react-dropzone';

type CreateTranslator = (key: string, values?: Record<string, string | number>) => string;

/** Browsers leave `type` empty or generic for some PDFs, so the extension also counts. */
export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/**
 * Copy for a file the dropzone refused (RIN-991): a wrong type gets its own
 * message instead of the "corrupted or password-protected" one.
 */
export function getPdfRejectionMessage(
  rejections: readonly FileRejection[],
  t: CreateTranslator,
  maxSizeMb: number,
): string {
  const codes = new Set(rejections[0]?.errors.map((error) => error.code));
  if (codes.has('file-invalid-type')) return t('pdfWrongType');
  if (codes.has('file-too-large')) return t('pdfTooLarge', { size: maxSizeMb });
  return t('pdfUnreadable');
}
