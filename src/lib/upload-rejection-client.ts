import {
  uploadExtension,
  uploadSizeBucket,
  type UploadRejectionReason,
  type UploadSurface,
} from '@/shared/constants/upload-counters';

const UPLOAD_REJECTION_ENDPOINT = '/api/upload-rejections';

export interface UploadRejectionReport {
  /** Only its extension and size bucket are read; the name and content never leave the browser. */
  file: Pick<File, 'name' | 'size'>;
  reason: UploadRejectionReason;
  surface: UploadSurface;
}

/**
 * Counts a file an upload surface refused (RIN-1785): extension, reason,
 * surface and size bucket, no consent needed because nothing about the learner
 * is sent. Fire and forget (`navigator.sendBeacon`); it never throws and never delays the UI.
 */
export function reportUploadRejection({ file, reason, surface }: UploadRejectionReport): void {
  try {
    const body = JSON.stringify({
      ext: uploadExtension(file.name),
      reason,
      surface,
      sizeBucket: uploadSizeBucket(file.size),
    });
    // sendBeacon survives a page unload and needs no response handling; a refused
    // beacon (full queue) is dropped, since counting is best effort.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(
        UPLOAD_REJECTION_ENDPOINT,
        new Blob([body], { type: 'application/json' }),
      );
    }
  } catch {
    // Counting is best effort.
  }
}

/** A react-dropzone refusal as a counted reason: type and size are the two it can give. */
export function reportDropzoneRejection(
  rejections: readonly { file: File; errors: readonly { code: string }[] }[],
  surface: UploadSurface,
): void {
  const first = rejections[0];
  if (!first) return;
  const codes = first.errors.map((error) => error.code);
  const reason: UploadRejectionReason = codes.includes('file-invalid-type')
    ? 'wrong_type'
    : codes.includes('file-too-large')
      ? 'too_large'
      : 'unreadable';
  reportUploadRejection({ file: first.file, reason, surface });
}
