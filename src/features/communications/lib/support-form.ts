/**
 * Client-side checks for the support forms (RIN-1018). They mirror the server's
 * request schema (`src/dtos/communication.ts`) so the learner sees an inline,
 * localised message instead of the browser's native tooltip or a 400.
 */
export const SUPPORT_MAX_IMAGES = 3;
const SUPPORT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const SUPPORT_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';
const SUPPORT_IMAGE_TYPES = new Set(SUPPORT_IMAGE_ACCEPT.split(','));
const SUPPORT_SUBJECT_MIN = 4;

export type SupportFieldError = 'subjectTooShort' | 'bodyRequired' | 'replyRequired';

export interface SupportRequestErrors {
  subject?: SupportFieldError | undefined;
  body?: SupportFieldError | undefined;
}

export function validateSupportRequest(subject: string, body: string): SupportRequestErrors {
  const errors: SupportRequestErrors = {};
  if (subject.trim().length < SUPPORT_SUBJECT_MIN) errors.subject = 'subjectTooShort';
  if (body.trim().length === 0) errors.body = 'bodyRequired';
  return errors;
}

export function validateSupportReply(body: string): SupportFieldError | null {
  return body.trim().length === 0 ? 'replyRequired' : null;
}

/** Stable identity of a picked file, also used as its list key. */
export function supportImageKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

/**
 * Adds picked images to the current selection: only PNG, JPEG or WebP up to 5 MB,
 * no file twice, and never more than three in total. `rejected` is true when any
 * picked file was left out.
 */
export function acceptSupportImages(
  current: readonly File[],
  picked: readonly File[],
): { files: File[]; rejected: boolean } {
  const taken = new Set(current.map(supportImageKey));
  const valid = picked.filter((file) => {
    const key = supportImageKey(file);
    if (taken.has(key)) return false;
    taken.add(key);
    return (
      SUPPORT_IMAGE_TYPES.has(file.type) && file.size > 0 && file.size <= SUPPORT_IMAGE_MAX_BYTES
    );
  });
  const added = valid.slice(0, Math.max(0, SUPPORT_MAX_IMAGES - current.length));
  return { files: [...current, ...added], rejected: added.length < picked.length };
}
