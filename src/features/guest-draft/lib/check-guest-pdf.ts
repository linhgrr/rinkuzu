import { getPdfPageCount } from '@/lib/pdf';
import { GUEST_DRAFT_MAX_PAGES, GUEST_DRAFT_MAX_PDF_BYTES } from '@/shared/constants/guest-draft';

export type GuestPdfCheck = 'ok' | 'not_pdf' | 'too_large';

function looksLikePdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/**
 * The browser half of the guest limits (RIN-1448 AC2): type, size, then pages, so a PDF
 * over the trial limit is refused before anything is uploaded. A PDF the browser cannot
 * read (encrypted, unusual structure) passes: the server has the last word on it.
 */
export async function checkGuestPdf(file: File): Promise<GuestPdfCheck> {
  if (!looksLikePdf(file)) return 'not_pdf';
  if (file.size > GUEST_DRAFT_MAX_PDF_BYTES) return 'too_large';
  try {
    return (await getPdfPageCount(file)) > GUEST_DRAFT_MAX_PAGES ? 'too_large' : 'ok';
  } catch {
    return 'ok';
  }
}
