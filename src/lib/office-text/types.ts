/**
 * Browser-side text extraction for Word and PowerPoint files (RIN-1784). The extracted text
 * goes to the existing text-draft routes, so the API's caps, quota and TTL are unchanged.
 */
export type OfficeFileType = 'docx' | 'pptx';

export type OfficeRejectReason =
  'too_large' | 'legacy_format' | 'encrypted' | 'corrupt' | 'too_little_text' | 'wrong_type';

export type OfficeTextResult =
  | { ok: true; text: string; fileType: OfficeFileType; truncated: boolean }
  | { ok: false; reason: OfficeRejectReason };

/** A file bigger than this is refused before it is read (the browser never uploads it). */
export const OFFICE_MAX_FILE_BYTES = 20 * 1024 * 1024;
/** Declared uncompressed size of the XML parts we unzip; above it the file is a zip bomb. */
export const OFFICE_MAX_UNZIPPED_BYTES = 30 * 1024 * 1024;
