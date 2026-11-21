import { getPdfPageCount } from '@/lib/pdf';
import { OFFICE_MAX_FILE_BYTES } from '@/lib/office-text/types';
import {
  GUEST_DRAFT_MAX_PAGES,
  GUEST_DRAFT_MAX_PDF_BYTES,
  type GuestDraftFileType,
} from '@/shared/constants/guest-draft';

export type GuestPdfCheck = 'ok' | 'not_pdf' | 'too_large' | 'office_too_large' | 'legacy_format';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const LEGACY_MIMES: readonly string[] = ['application/msword', 'application/vnd.ms-powerpoint'];

/**
 * What the file picker offers (RIN-1786): PDF, .docx and .pptx by MIME and by extension,
 * since phones often send an empty or generic type, plus .doc and .ppt so a legacy file
 * reaches the "save as .docx or PDF" message instead of being greyed out.
 */
export const GUEST_FILE_ACCEPT = [
  'application/pdf',
  '.pdf',
  DOCX_MIME,
  '.docx',
  PPTX_MIME,
  '.pptx',
  ...LEGACY_MIMES,
  '.doc',
  '.ppt',
].join(',');

function extensionOf(file: File): string {
  const name = file.name.toLowerCase();
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1);
}

function looksLikePdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function isLegacyOffice(file: File): boolean {
  const ext = extensionOf(file);
  return ext === 'doc' || ext === 'ppt' || LEGACY_MIMES.includes(file.type);
}

/** The Office type by extension, else by MIME type (a phone may name the file without one). */
function officeTypeOf(file: File): GuestDraftFileType | null {
  const ext = extensionOf(file);
  if (ext === 'docx' || ext === 'pptx') return ext;
  if (file.type === DOCX_MIME) return 'docx';
  return file.type === PPTX_MIME ? 'pptx' : null;
}

/**
 * A .docx or .pptx as the extractor reads it: its type, and the file under a name that ends
 * in that type (extraction goes by extension). Null for anything else.
 */
export function guestOfficeFile(file: File): { file: File; type: GuestDraftFileType } | null {
  const type = officeTypeOf(file);
  if (!type) return null;
  if (extensionOf(file) === type) return { file, type };
  return { file: new File([file], `${file.name}.${type}`, { type: file.type }), type };
}

/**
 * The browser half of the guest limits (RIN-1448 AC2): type, size, then pages, so a PDF
 * over the trial limit is refused before anything is uploaded. A PDF the browser cannot
 * read (encrypted, unusual structure) passes: the server has the last word on it. A Word or
 * PowerPoint file (RIN-1786) is checked for type and its own 20 MB limit only: its text is
 * read on submit, where the other refusals (password, corrupt, too little text) come from.
 */
export async function checkGuestPdf(file: File): Promise<GuestPdfCheck> {
  if (isLegacyOffice(file)) return 'legacy_format';
  if (!looksLikePdf(file)) {
    if (!officeTypeOf(file)) return 'not_pdf';
    return file.size > OFFICE_MAX_FILE_BYTES ? 'office_too_large' : 'ok';
  }
  if (file.size > GUEST_DRAFT_MAX_PDF_BYTES) return 'too_large';
  try {
    return (await getPdfPageCount(file)) > GUEST_DRAFT_MAX_PAGES ? 'too_large' : 'ok';
  } catch {
    return 'ok';
  }
}
