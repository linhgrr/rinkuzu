/**
 * Allow-lists for the daily upload counters (RIN-1785). Shared by the browser
 * helper and the route so both sides agree; every value a client sends is
 * mapped onto one of these, so the collection stays small and holds no
 * free text.
 */
export type UploadCounterKind = 'file_rejected' | 'office_draft_created';

export const UPLOAD_REJECTION_REASONS = [
  'wrong_type',
  'too_large',
  'legacy_format',
  'encrypted',
  'corrupt',
  'too_little_text',
  'too_many_pages',
  'unreadable',
] as const;
export type UploadRejectionReason = (typeof UPLOAD_REJECTION_REASONS)[number];

export const UPLOAD_SURFACES = [
  'try_pdf',
  'try_slides',
  'create_pdf',
  'create_pdf_mobile',
  'adaptive_upload',
  'dashboard_upload',
] as const;
export type UploadSurface = (typeof UPLOAD_SURFACES)[number];

export const UPLOAD_SIZE_BUCKETS = ['<1MB', '1-5MB', '5-20MB', '>20MB'] as const;
export type UploadSizeBucket = (typeof UPLOAD_SIZE_BUCKETS)[number];

/** Anything that is not 1-8 lower-case letters or digits is counted as this. */
const UPLOAD_EXT_OTHER = 'other';
const EXT_PATTERN = /^[a-z0-9]{1,8}$/;

const MB = 1024 * 1024;

export function uploadSizeBucket(bytes: number): UploadSizeBucket {
  if (!Number.isFinite(bytes) || bytes < MB) return '<1MB';
  if (bytes < 5 * MB) return '1-5MB';
  if (bytes <= 20 * MB) return '5-20MB';
  return '>20MB';
}

/** Lower-case extension of a file name without the dot, or `other`. Never keeps the name. */
export function uploadExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const ext = dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase();
  return normalizeUploadExt(ext);
}

export function normalizeUploadExt(value: string): string {
  return EXT_PATTERN.test(value) ? value : UPLOAD_EXT_OTHER;
}
